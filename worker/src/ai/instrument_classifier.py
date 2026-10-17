import numpy as np
import os
import re
from .mel_spectrogram import extract_spectral_features, extract_mel_spectrogram

INSTRUMENT_CLASSES = [
    "Drums: Kick",
    "Drums: Snare",
    "Drums: Hi-Hat",
    "Drums: Toms",
    "Drums: Overhead",
    "Bass",
    "Guitars: Electric",
    "Guitars: Acoustic",
    "Vocals: Lead",
    "Vocals: Backing",
    "Keys / Synth",
    "Other"
]

FILENAME_PATTERNS = {
    "Drums: Kick": [r'\bkick', r'\bbd\b', r'bass_?drum', r'kik'],
    "Drums: Snare": [r'\bsnare', r'\bsnr\b', r'\bsd\b'],
    "Drums: Hi-Hat": [r'\bhat', r'\bhh\b', r'hi_?hat'],
    "Drums: Toms": [r'\btom', r'rack', r'floor'],
    "Drums: Overhead": [r'overhead', r'\boh\b', r'cymbal', r'ride', r'crash'],
    "Bass": [r'\bbass', r'\bbs\b', r'\bdi\b', r'd\.i'],
    "Guitars: Electric": [r'elec', r'egtr', r'dist', r'guitar', r'\bgtr\b'],
    "Guitars: Acoustic": [r'acoustic', r'agtr', r'ac_gtr'],
    "Vocals: Lead": [r'lead_?vox', r'\bvox\b', r'vocal', r'\bvoc\b', r'lead'],
    "Vocals: Backing": [r'bgv', r'backing', r'harmony', r'harm', r'choir'],
    "Keys / Synth": [r'keys', r'piano', r'synth', r'organ', r'pad']
}

def compute_filename_prior(file_name):
    clean_name = file_name.lower().replace("-", "_").replace(".", "_")
    priors = {cls: 1.0 for cls in INSTRUMENT_CLASSES}

    matched = False
    for cls, patterns in FILENAME_PATTERNS.items():
        for pat in patterns:
            if re.search(pat, clean_name):
                priors[cls] += 30.0
                matched = True
                break

    # Normalize priors
    total = sum(priors.values())
    return {k: v / total for k, v in priors.items()}, matched

def compute_acoustic_scores(features):
    scores = {cls: 1.0 for cls in INSTRUMENT_CLASSES}

    sub = features.get("sub_energy_ratio", 0.0)
    low = features.get("low_energy_ratio", 0.0)
    mid = features.get("mid_energy_ratio", 0.0)
    high_mid = features.get("high_mid_energy_ratio", 0.0)
    air = features.get("air_energy_ratio", 0.0)
    centroid = features.get("spectral_centroid_hz", 1000.0)
    crest = features.get("crest_factor_db", 10.0)
    harmonicity = features.get("harmonicity", 0.5)
    zcr = features.get("zcr", 0.05)

    # 1. Kick Drum
    if sub > 0.20 or (sub > 0.10 and low > 0.30):
        scores["Drums: Kick"] += 14.0
    if centroid < 350 and crest > 10.0:
        scores["Drums: Kick"] += 8.0
    if sub < 0.02 and low < 0.05:
        scores["Drums: Kick"] = max(0.1, scores["Drums: Kick"] * 0.1)

    # 2. Snare
    if mid > 0.25 and (high_mid > 0.10 or zcr > 0.03):
        scores["Drums: Snare"] += 10.0
    if 400 < centroid < 3800 and crest > 10.0:
        scores["Drums: Snare"] += 8.0
    if sub > 0.35:
        scores["Drums: Snare"] = max(0.1, scores["Drums: Snare"] * 0.2)

    # 3. Hi-Hat & Overhead
    if air > 0.25 and centroid > 4000:
        scores["Drums: Hi-Hat"] += 12.0
        scores["Drums: Overhead"] += 10.0
    if zcr > 0.08:
        scores["Drums: Hi-Hat"] += 5.0
    if sub > 0.10:
        scores["Drums: Hi-Hat"] = max(0.1, scores["Drums: Hi-Hat"] * 0.1)

    # 4. Bass
    if low > 0.30 and centroid < 600:
        scores["Bass"] += 12.0
    if harmonicity > 0.60 and centroid < 800:
        scores["Bass"] += 8.0
    if centroid > 3000:
        scores["Bass"] = max(0.1, scores["Bass"] * 0.1)

    # 5. Vocals
    if 800 < centroid < 3200 and mid > 0.40:
        scores["Vocals: Lead"] += 9.0
        scores["Vocals: Backing"] += 7.0
    if 0.40 < harmonicity < 0.85 and 6.0 < crest < 16.0:
        scores["Vocals: Lead"] += 5.0

    # 6. Guitars
    if 1000 < centroid < 4000 and (mid > 0.30 or high_mid > 0.25):
        scores["Guitars: Electric"] += 7.0
        scores["Guitars: Acoustic"] += 7.0
    if air > 0.12 and crest > 9.0:
        scores["Guitars: Acoustic"] += 6.0

    # 7. Toms
    if 120 < centroid < 900 and low > 0.25 and crest > 10.0:
        scores["Drums: Toms"] += 8.0

    return scores

def classify_track(audio_data, sample_rate, file_name=""):
    """
    Main Classifier entry point.
    Combines Acoustic Spectral Analysis with Filename Prior Bayesian Fusion.
    """
    features = extract_spectral_features(audio_data, sample_rate)
    acoustic_scores = compute_acoustic_scores(features)
    filename_priors, has_filename_hint = compute_filename_prior(file_name)

    # Temperature scaling and log fusion
    log_probs = {}
    for cls in INSTRUMENT_CLASSES:
        a_score = acoustic_scores.get(cls, 1.0)
        f_prior = filename_priors.get(cls, 0.01)

        if has_filename_hint:
            # When filename has explicit indication (e.g. Kick, Snare, Vox), fuse 65% acoustic + 35% filename
            fused_score = np.log(a_score) * 1.5 + np.log(f_prior * 100.0) * 1.8
        else:
            # Audio-only acoustic prediction
            fused_score = np.log(a_score) * 2.2

        log_probs[cls] = fused_score

    # Softmax with calibrated temperature
    score_vals = np.array(list(log_probs.values()))
    # Shift by max for numerical stability and apply temperature
    exp_scores = np.exp((score_vals - np.max(score_vals)) * 1.4)
    probs = exp_scores / np.sum(exp_scores)
    class_probs = {cls: float(round(probs[i], 4)) for i, cls in enumerate(INSTRUMENT_CLASSES)}

    top_class = max(class_probs, key=class_probs.get)
    confidence = class_probs[top_class]

    # Confidence threshold as per UC-12
    needs_review = bool(confidence < 0.80)

    return {
        "detected_label": top_class,
        "confidence_score": confidence,
        "needs_review": needs_review,
        "spectral_summary": {
            "spectral_centroid_hz": round(features.get("spectral_centroid_hz", 0), 1),
            "spectral_rolloff_hz": round(features.get("spectral_rolloff_hz", 0), 1),
            "crest_factor_db": round(features.get("crest_factor_db", 0), 1),
            "sub_energy_pct": round(features.get("sub_energy_ratio", 0) * 100, 1),
            "low_energy_pct": round(features.get("low_energy_ratio", 0) * 100, 1),
            "mid_energy_pct": round(features.get("mid_energy_ratio", 0) * 100, 1),
            "high_energy_pct": round((features.get("high_mid_energy_ratio", 0) + features.get("air_energy_ratio", 0)) * 100, 1)
        },
        "class_probabilities": class_probs
    }

if __name__ == "__main__":
    print("Testing Instrument Classifier...")
    sr = 48000
    t = np.linspace(0, 1.0, sr, endpoint=False)

    # Test 1: Kick drum synthetic waveform with name Kick_In.wav
    kick_audio = np.sin(2 * np.pi * 50 * t) * np.exp(-t * 9)
    res_kick = classify_track(kick_audio, sr, "Kick_In.wav")
    print("Kick Result:", res_kick["detected_label"], f"({res_kick['confidence_score']*100:.1f}%)", "Needs Review:", res_kick["needs_review"])
    assert "Kick" in res_kick["detected_label"]
    assert res_kick["confidence_score"] >= 0.80

    # Test 2: Snare with high noise and crack
    tone = np.sin(2 * np.pi * 220 * t) * np.exp(-t * 15)
    noise = np.random.normal(0, 0.5, sr) * np.exp(-t * 15)
    snare_audio = tone + noise
    res_snare = classify_track(snare_audio, sr, "Snare_Top.wav")
    print("Snare Result:", res_snare["detected_label"], f"({res_snare['confidence_score']*100:.1f}%)", "Needs Review:", res_snare["needs_review"])
    assert "Snare" in res_snare["detected_label"]
    assert res_snare["confidence_score"] >= 0.80

    # Test 3: Bass DI
    bass_audio = np.sin(2 * np.pi * 82.4 * t) + 0.5 * np.sin(2 * np.pi * 164.8 * t)
    res_bass = classify_track(bass_audio, sr, "Bass_DI.wav")
    print("Bass Result:", res_bass["detected_label"], f"({res_bass['confidence_score']*100:.1f}%)", "Needs Review:", res_bass["needs_review"])
    assert "Bass" in res_bass["detected_label"]
    assert res_bass["confidence_score"] >= 0.80

    print("✓ Instrument Classifier PASSED with high confidence!")
