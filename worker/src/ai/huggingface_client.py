import os
import sys
import io
import re
import requests
import numpy as np
import scipy.signal
import soundfile as sf
from dotenv import load_dotenv

load_dotenv()

# AudioSet (MIT/ast-finetuned-audioset-10-10-0.4593) to Polaris Audio class mapping
AUDIOSET_TO_POLARIS = {
    # Kick
    "bass drum": "Drums: Kick",
    "kick drum": "Drums: Kick",
    
    # Snare
    "snare drum": "Drums: Snare",
    "rimshot": "Drums: Snare",
    
    # Hi-Hat
    "hi-hat": "Drums: Hi-Hat",
    
    # Toms
    "tom-tom drum": "Drums: Toms",
    "timpani": "Drums: Toms",
    "bongo": "Drums: Toms",
    "conga": "Drums: Toms",
    
    # Overhead / Cymbals
    "cymbal": "Drums: Overhead",
    "crash cymbal": "Drums: Overhead",
    
    # Drums generic
    "drum kit": "Drums: Overhead",
    "drum machine": "Drums: Kick",
    "percussion": "Drums: Overhead",
    "drum": "Drums: Snare",
    
    # Bass
    "bass guitar": "Bass",
    "double bass": "Bass",
    
    # Guitars
    "electric guitar": "Guitars: Electric",
    "distortion": "Guitars: Electric",
    "acoustic guitar": "Guitars: Acoustic",
    "guitar": "Guitars: Electric",
    "plucked string instrument": "Guitars: Acoustic",
    "strum": "Guitars: Acoustic",
    
    # Vocals
    "singing": "Vocals: Lead",
    "male singing": "Vocals: Lead",
    "female singing": "Vocals: Lead",
    "vocal music": "Vocals: Lead",
    "speech": "Vocals: Lead",
    "shout": "Vocals: Lead",
    "screaming": "Vocals: Lead",
    "choir": "Vocals: Backing",
    "harmony": "Vocals: Backing",
    "chant": "Vocals: Backing",
    "cheering": "Vocals: Backing",
    
    # Keys & Synth
    "piano": "Keys / Synth",
    "electric piano": "Keys / Synth",
    "keyboard (musical)": "Keys / Synth",
    "synthesizer": "Keys / Synth",
    "organ": "Keys / Synth",
    "sampler": "Keys / Synth"
}

# Generic meta-classes from AudioSet ontology that are non-discriminative for stem mixing
IGNORED_AUDIOSET_LABELS = {
    "music", "musical instrument", "sound effect", "audio", "noise",
    "background music", "electronic music", "heart murmur", "sine wave",
    "chirp tone", "beep, bleep", "dial tone", "busy signal", "buzzer", "techno"
}

def map_hf_predictions_to_polaris(predictions):
    """
    Maps raw Hugging Face classification list [{label, score}, ...] to Polaris Audio schema.
    Filters non-discriminative AudioSet meta-tags (e.g. 'music', 'sine wave').
    """
    if not isinstance(predictions, list):
        return None

    # Accumulate scores for Polaris categories
    polaris_scores = {}
    raw_top_label = predictions[0].get("label", "Other") if predictions else "Other"
    raw_top_score = predictions[0].get("score", 0.5) if predictions else 0.5

    for item in predictions:
        hf_label = item.get("label", "").lower().strip()
        score = float(item.get("score", 0.0))

        # Skip generic non-discriminative tags
        if any(ign in hf_label for ign in IGNORED_AUDIOSET_LABELS):
            continue

        # Check exact and substring match
        matched_class = None
        for key, val in AUDIOSET_TO_POLARIS.items():
            if key in hf_label:
                matched_class = val
                break

        if matched_class:
            polaris_scores[matched_class] = polaris_scores.get(matched_class, 0.0) + score

    # Select best mapped category
    if polaris_scores and max(polaris_scores.values()) >= 0.20:
        best_class = max(polaris_scores, key=polaris_scores.get)
        confidence = round(polaris_scores[best_class], 4)
    else:
        best_class = "Other"
        confidence = 0.50

    return {
        "detected_label": best_class,
        "confidence_score": min(0.99, max(0.50, confidence)),
        "raw_hf_top_label": raw_top_label,
        "raw_hf_top_score": raw_top_score
    }

def prepare_audio_signal_for_hf(audio_data, sample_rate, target_sr=16000, max_duration_sec=7.0):
    """
    Downmixes to mono, takes a representative energetic slice (up to max_duration_sec),
    resamples to target_sr (16 kHz for AST), and normalizes peak to -1.0 dBFS.
    Returns (resampled_signal, target_sr).
    """
    # 1. Downmix to mono
    if audio_data.ndim > 1:
        signal = np.mean(audio_data, axis=1)
    else:
        signal = audio_data.astype(np.float32)

    # 2. Select representative audio window (find segment with highest RMS)
    total_samples = len(signal)
    slice_samples = int(max_duration_sec * sample_rate)

    if total_samples > slice_samples:
        # Check energy in 3 sections (20%, 40%, 60%) to pick active music
        offsets = [
            int(total_samples * 0.15),
            int(total_samples * 0.35),
            int(total_samples * 0.55)
        ]
        best_offset = offsets[0]
        max_energy = -1.0
        for off in offsets:
            chunk = signal[off:off + slice_samples]
            energy = np.mean(chunk ** 2)
            if energy > max_energy:
                max_energy = energy
                best_offset = off
        selected_signal = signal[best_offset:best_offset + slice_samples]
    else:
        selected_signal = signal

    # 3. Resample to target_sr (16000 Hz)
    if sample_rate != target_sr:
        num_resampled = int(len(selected_signal) * target_sr / sample_rate)
        resampled_signal = scipy.signal.resample(selected_signal, num_resampled)
    else:
        resampled_signal = selected_signal

    # 4. Normalize peak to -1.0 dBFS to prevent clipping in inference
    peak = np.max(np.abs(resampled_signal))
    if peak > 1e-4:
        resampled_signal = resampled_signal / peak * 0.89

    return resampled_signal.astype(np.float32), target_sr

def prepare_audio_for_hf(audio_data, sample_rate, target_sr=16000, max_duration_sec=7.0):
    """
    Downmixes to mono, takes an energetic slice, resamples to 16 kHz,
    and encodes to lossless 16-bit WAV bytes.
    """
    resampled_signal, sr = prepare_audio_signal_for_hf(audio_data, sample_rate, target_sr, max_duration_sec)
    wav_buf = io.BytesIO()
    sf.write(wav_buf, resampled_signal, sr, format='WAV', subtype='PCM_16')
    return wav_buf.getvalue()


# Singleton instance cache for local Hugging Face pipeline
_LOCAL_PIPELINE = None
_LOCAL_PIPELINE_ATTEMPTED = False

def get_local_ast_pipeline(model_id=None):
    """
    Lazy-loads the local Hugging Face AST audio classification pipeline (CPU).
    Singleton instance avoids redundant reloading across multiple stem classifications.
    """
    global _LOCAL_PIPELINE, _LOCAL_PIPELINE_ATTEMPTED
    if _LOCAL_PIPELINE is not None:
        return _LOCAL_PIPELINE
    if _LOCAL_PIPELINE_ATTEMPTED:
        return None

    if not model_id:
        model_id = os.getenv("HUGGINGFACE_MODEL_ID", "MIT/ast-finetuned-audioset-10-10-0.4593").strip()

    _LOCAL_PIPELINE_ATTEMPTED = True
    try:
        from transformers import pipeline
        print(f"[HuggingFaceLocal] Initializing AST pipeline for '{model_id}' (CPU)...", file=sys.stderr)
        _LOCAL_PIPELINE = pipeline(
            task="audio-classification",
            model=model_id,
            device=-1
        )
        print(f"[HuggingFaceLocal] Pipeline '{model_id}' loaded successfully.", file=sys.stderr)
        return _LOCAL_PIPELINE
    except Exception as exc:
        print(f"[HuggingFaceLocal] Could not load local pipeline ({exc}). Will fallback.", file=sys.stderr)
        return None

def query_local_huggingface_model(audio_data, sample_rate, model_id=None):
    """
    Runs inference locally using Hugging Face transformers pipeline on CPU.
    Returns mapped Polaris dict or None if model unavailable/failed.
    """
    if not model_id:
        model_id = os.getenv("HUGGINGFACE_MODEL_ID", "MIT/ast-finetuned-audioset-10-10-0.4593").strip()

    pipe = get_local_ast_pipeline(model_id)
    if pipe is None:
        return None

    try:
        signal, sr = prepare_audio_signal_for_hf(audio_data, sample_rate)
        raw_dict = {"raw": signal, "sampling_rate": sr}
        raw_preds = pipe(raw_dict, top_k=5)
        mapped = map_hf_predictions_to_polaris(raw_preds)
        if mapped:
            mapped["inference_source"] = f"huggingface_local:{model_id}"
            return mapped
    except Exception as err:
        print(f"[HuggingFaceLocal Error] Local AST inference failed: {err}", file=sys.stderr)
    return None

def query_huggingface_model(audio_data, sample_rate, file_name=""):
    """
    Hybrid inference strategy:
    1. First attempts local Hugging Face AST pipeline (offline, zero-cost, resilient).
    2. If local model not available or returns None, tries remote HF Inference HTTP API.
    3. Returns None if both are unavailable (caller will fallback to Acoustic Spectral Analysis).
    """
    model_id = os.getenv("HUGGINGFACE_MODEL_ID", "MIT/ast-finetuned-audioset-10-10-0.4593").strip()

    # 1. Try local pipeline first
    local_res = query_local_huggingface_model(audio_data, sample_rate, model_id=model_id)
    if local_res is not None:
        return local_res

    # 2. Try remote API only if local pipeline is unavailable (e.g. minimal docker/env)
    hf_token = os.getenv("HUGGINGFACE_API_KEY", "").strip()
    if not hf_token:
        return None

    wav_bytes = prepare_audio_for_hf(audio_data, sample_rate)
    headers = {
        "Authorization": f"Bearer {hf_token}",
        "Content-Type": "audio/wav"
    }

    # Primary and fallback Hugging Face router endpoints
    endpoints = [
        f"https://router.huggingface.co/hf-inference/models/{model_id}",
        f"https://api-inference.huggingface.co/models/{model_id}"
    ]

    for url in endpoints:
        try:
            response = requests.post(url, headers=headers, data=wav_bytes, timeout=8)
            if response.status_code == 200:
                predictions = response.json()
                mapped = map_hf_predictions_to_polaris(predictions)
                if mapped:
                    mapped["inference_source"] = f"huggingface_remote:{model_id}"
                    return mapped
            else:
                # Log detailed debug for visibility
                print(f"[HuggingFaceClient Info] Endpoint {url} returned HTTP {response.status_code}: {response.text[:120]}", file=sys.stderr)
        except Exception as err:
            print(f"[HuggingFaceClient Notice] Connection to {url} skipped ({err}).", file=sys.stderr)

    return local_res
