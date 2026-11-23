import os
from typing import Callable

import numpy as np
from scipy.signal import butter, sosfiltfilt

try:
    from .silence_trimmer import TARGET_SAMPLE_RATE, decode_audio_bytes, encode_wav_bytes
except (ImportError, ValueError):
    from workbench.silence_trimmer import TARGET_SAMPLE_RATE, decode_audio_bytes, encode_wav_bytes

STEM_ORDER = ("vocals", "drums", "bass", "other")
_DEMUCS_MODEL = None


def _notify_progress(callback: Callable[[int, str], None] | None, progress: int, message: str) -> None:
    if callback is not None:
        callback(progress, message)


def _fast_crossover_separate(audio_data: np.ndarray, sample_rate: int) -> dict[str, np.ndarray]:
    """Deterministic zero-phase Butterworth crossover separation for fast CI/testing mode."""
    total_samples = audio_data.shape[0]
    if total_samples < 32:
        # Too short for filtfilt padding; return zero-aligned copies cleanly
        return {
            "bass": audio_data.copy(),
            "vocals": audio_data.copy(),
            "drums": np.zeros_like(audio_data),
            "other": np.zeros_like(audio_data),
        }

    sos_low = butter(4, 180.0, btype="lowpass", fs=sample_rate, output="sos")
    sos_mid = butter(4, [180.0, 2500.0], btype="bandpass", fs=sample_rate, output="sos")
    sos_high = butter(4, 2500.0, btype="highpass", fs=sample_rate, output="sos")

    bass = sosfiltfilt(sos_low, audio_data, axis=0).astype(np.float32)
    vocals = sosfiltfilt(sos_mid, audio_data, axis=0).astype(np.float32)
    drums = sosfiltfilt(sos_high, audio_data, axis=0).astype(np.float32)
    other = (audio_data - (bass + vocals + drums)).astype(np.float32)

    return {
        "vocals": vocals,
        "drums": drums,
        "bass": bass,
        "other": other,
    }


def _align_sample_length(audio_2d: np.ndarray, target_samples: int) -> np.ndarray:
    """Trim or zero-pad stereo (N, 2) array to match target_samples exactly."""
    current = audio_2d.shape[0]
    if current > target_samples:
        return np.ascontiguousarray(audio_2d[:target_samples], dtype=np.float32)
    if current < target_samples:
        pad = np.zeros((target_samples - current, 2), dtype=np.float32)
        return np.ascontiguousarray(np.vstack([audio_2d, pad]), dtype=np.float32)
    return np.ascontiguousarray(audio_2d, dtype=np.float32)


def _demucs_separate(
    audio_data: np.ndarray,
    sample_rate: int,
    progress_callback: Callable[[int, str], None] | None = None,
) -> dict[str, np.ndarray]:
    """Run singleton htdemucs separation with lazy torch/torchaudio/demucs imports."""
    global _DEMUCS_MODEL

    _notify_progress(progress_callback, 15, "Loading Model")
    import torch
    import torchaudio
    from demucs.apply import apply_model
    from demucs.pretrained import get_model

    device = "cuda" if torch.cuda.is_available() else "cpu"
    if _DEMUCS_MODEL is None:
        model = get_model("htdemucs")
        model.eval()
        model.to(device)
        _DEMUCS_MODEL = model
    else:
        model = _DEMUCS_MODEL

    _notify_progress(progress_callback, 35, "Separating Stems")

    target_samples = audio_data.shape[0]
    wav_tensor = torch.from_numpy(audio_data.T.copy()).float()  # (2, N)

    model_sr = int(model.samplerate)
    if model_sr != sample_rate:
        wav_tensor = torchaudio.functional.resample(wav_tensor, sample_rate, model_sr)

    with torch.no_grad():
        sources = apply_model(
            model,
            wav_tensor.unsqueeze(0).to(device),
            shifts=1,
            split=True,
            overlap=0.25,
        )[0].cpu()

    source_names = list(model.sources)
    stems_np: dict[str, np.ndarray] = {}
    for stem_name in STEM_ORDER:
        if stem_name not in source_names:
            stems_np[stem_name] = np.zeros((target_samples, 2), dtype=np.float32)
            continue
        idx = source_names.index(stem_name)
        stem_tensor = sources[idx]  # (2, M)
        if model_sr != sample_rate:
            stem_tensor = torchaudio.functional.resample(stem_tensor, model_sr, sample_rate)
        stem_2d = stem_tensor.T.numpy().astype(np.float32)
        stems_np[stem_name] = _align_sample_length(stem_2d, target_samples)

    return stems_np


def separate_audio_stems(
    audio_bytes: bytes,
    file_name: str,
    use_fast_fallback: bool | None = None,
    progress_callback: Callable[[int, str], None] | None = None,
) -> dict:
    """Separate stereo audio bytes into 4 zero-aligned stems (vocals, drums, bass, other) at 48 kHz."""
    fast_mode = (
        use_fast_fallback
        if use_fast_fallback is not None
        else os.getenv("POLARIS_FAST_STEM_MODE", "0") == "1"
    )

    audio_data, sr = decode_audio_bytes(audio_bytes, file_name)
    total_samples = audio_data.shape[0]
    duration_sec = float(total_samples / sr)

    if fast_mode:
        _notify_progress(progress_callback, 35, "Separating Stems")
        stems_arrays = _fast_crossover_separate(audio_data, sr)
    else:
        stems_arrays = _demucs_separate(audio_data, sr, progress_callback=progress_callback)

    encoded_stems = {
        name: encode_wav_bytes(_align_sample_length(stems_arrays[name], total_samples), TARGET_SAMPLE_RATE)
        for name in STEM_ORDER
    }

    return {
        "sample_rate": TARGET_SAMPLE_RATE,
        "duration_sec": duration_sec,
        "stems": encoded_stems,
    }
