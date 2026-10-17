import numpy as np
import scipy.signal

def compute_true_peak(audio, sample_rate, oversample=4):
    """
    Computes True-Peak (dBFS) using polyphase 4x oversampling (ITU-R BS.1770-4 style).
    Catches Inter-Sample Peaks (ISP) that exceed 0 dBFS between digital samples.
    """
    if len(audio) == 0:
        return -120.0, 0.0

    # Ensure 2D format: list of 1D channels
    if audio.ndim == 2:
        if audio.shape[0] <= 2 and audio.shape[0] < audio.shape[1]:
            channels = [audio[c] for c in range(audio.shape[0])]
        else:
            channels = [audio[:, c] for c in range(audio.shape[1])]
    else:
        channels = [audio]

    max_tp_linear = 0.0
    for ch in channels:
        if len(ch) == 0:
            continue
        # For long files, chunk in 10-second segments to maintain efficient memory usage
        chunk_size = sample_rate * 10
        if len(ch) > chunk_size:
            for start in range(0, len(ch), chunk_size):
                chunk = ch[start:start + chunk_size]
                resampled = scipy.signal.resample_poly(chunk, up=oversample, down=1)
                pk = np.max(np.abs(resampled))
                if pk > max_tp_linear:
                    max_tp_linear = pk
        else:
            resampled = scipy.signal.resample_poly(ch, up=oversample, down=1)
            pk = np.max(np.abs(resampled))
            if pk > max_tp_linear:
                max_tp_linear = pk

    tp_dbfs = 20.0 * np.log10(max(float(max_tp_linear), 1e-6))
    return round(float(tp_dbfs), 2), float(max_tp_linear)

def detect_clipping(audio, sample_rate, threshold_dbfs=-0.1, consecutive_samples=3):
    """
    Detects digital clipping:
    - Samples reaching full scale (|sample| >= 0.999)
    - Consecutive clamped samples (>= consecutive_samples)
    - True-peak >= threshold_dbfs (-0.1 dBFS)
    """
    if audio.ndim == 2:
        if audio.shape[0] <= 2 and audio.shape[0] < audio.shape[1]:
            channels = [audio[c] for c in range(audio.shape[0])]
        else:
            channels = [audio[:, c] for c in range(audio.shape[1])]
    else:
        channels = [audio]

    total_clamped_runs = 0
    max_consecutive = 0
    tp_dbfs, _ = compute_true_peak(audio, sample_rate)

    for ch in channels:
        abs_ch = np.abs(ch)
        clamped = (abs_ch >= 0.999).astype(np.int8)

        # Count consecutive clamped runs
        if np.any(clamped):
            diffs = np.diff(np.concatenate(([0], clamped, [0])))
            run_starts = np.where(diffs == 1)[0]
            run_ends = np.where(diffs == -1)[0]
            run_lengths = run_ends - run_starts

            severe_runs = run_lengths[run_lengths >= consecutive_samples]
            total_clamped_runs += len(severe_runs)
            if len(run_lengths) > 0:
                max_consecutive = max(max_consecutive, int(np.max(run_lengths)))

    is_clipping = bool(tp_dbfs >= threshold_dbfs or total_clamped_runs > 0)

    return {
        "is_clipping": is_clipping,
        "true_peak_dbfs": tp_dbfs,
        "clamped_event_count": int(total_clamped_runs),
        "max_consecutive_clamped": int(max_consecutive)
    }

def compute_crest_factor_and_dynamics(audio):
    """
    Computes Crest Factor (Peak to RMS ratio in dB):
    Crest Factor = 20 * log10(Peak / RMS)
    RMS level (dBFS)
    Peak level (dBFS)
    """
    if len(audio) == 0:
        return {"crest_factor_db": 0.0, "peak_dbfs": -120.0, "rms_dbfs": -120.0}

    flat = audio.flatten()
    peak = float(np.max(np.abs(flat)))
    rms = float(np.sqrt(np.mean(flat ** 2))) + 1e-12

    peak_dbfs = 20.0 * np.log10(max(peak, 1e-6))
    rms_dbfs = 20.0 * np.log10(max(rms, 1e-6))
    crest_factor_db = 20.0 * np.log10(max(peak / rms, 1.0))

    return {
        "peak_dbfs": round(float(peak_dbfs), 2),
        "rms_dbfs": round(float(rms_dbfs), 2),
        "crest_factor_db": round(float(crest_factor_db), 2)
    }

def detect_dc_offset(audio, threshold=0.005):
    """
    Detects DC Offset:
    threshold 0.005 represents ~ -46 dBFS DC bias away from center 0.0.
    Prevents false positives on naturally asymmetrical musical decays.
    """
    if len(audio) == 0:
        return {"has_dc_offset": False, "dc_offset_val": 0.0, "dc_offset_pct": 0.0}

    flat = audio.flatten()
    mean_val = float(np.mean(flat))
    abs_mean = abs(mean_val)

    has_dc = bool(abs_mean >= threshold)
    return {
        "has_dc_offset": has_dc,
        "dc_offset_val": round(mean_val, 5),
        "dc_offset_pct": round(abs_mean * 100.0, 3)
    }

def detect_sub_rumble(audio, sample_rate, instrument_label="OTHER"):
    """
    Detects unwanted subsonic rumble (< 35 Hz).
    Non-bass instruments shouldn't have high sub-35Hz energy.
    Valid low-end instruments: BASS, KICK, 808, SUB, DRUMS
    """
    exempt_instruments = ["BASS", "KICK", "DRUMS"]
    label_upper = (instrument_label or "").upper()
    is_exempt = any(exempt in label_upper for exempt in exempt_instruments)

    if len(audio) == 0 or len(audio.flatten()) < sample_rate * 0.5:
        return {"has_sub_rumble": False, "sub_energy_ratio": 0.0, "is_exempt": is_exempt}

    # Mono mix for analysis
    if audio.ndim == 2:
        sig = np.mean(audio, axis=1 if audio.shape[1] <= 2 else 0)
    else:
        sig = audio

    # Butterworth 4th order low-pass at 35Hz
    nyquist = sample_rate * 0.5
    cutoff = min(35.0, nyquist * 0.9)
    sos = scipy.signal.butter(4, cutoff / nyquist, btype='lowpass', output='sos')
    sub_signal = scipy.signal.sosfilt(sos, sig)

    total_energy = np.sum(sig ** 2) + 1e-12
    sub_energy = np.sum(sub_signal ** 2)

    ratio = float(sub_energy / total_energy)
    sub_db = 10.0 * np.log10(max(ratio, 1e-12))

    # If non-exempt and sub energy ratio > 0.04 (-14 dB) and sub RMS is significant
    has_rumble = bool(not is_exempt and ratio > 0.04 and np.sqrt(np.mean(sub_signal ** 2)) > 0.005)

    return {
        "has_sub_rumble": has_rumble,
        "sub_energy_ratio": round(ratio, 4),
        "sub_db": round(float(sub_db), 2),
        "is_exempt": is_exempt
    }

def analyze_track_signals(audio, sample_rate, instrument_label="OTHER"):
    """
    Combined runner for single track signal metrics.
    """
    clip_info = detect_clipping(audio, sample_rate)
    dyn_info = compute_crest_factor_and_dynamics(audio)
    dc_info = detect_dc_offset(audio)
    rumble_info = detect_sub_rumble(audio, sample_rate, instrument_label)

    return {
        "true_peak_dbfs": clip_info["true_peak_dbfs"],
        "is_clipping": clip_info["is_clipping"],
        "clamped_event_count": clip_info["clamped_event_count"],
        "max_consecutive_clamped": clip_info["max_consecutive_clamped"],
        "peak_dbfs": dyn_info["peak_dbfs"],
        "rms_dbfs": dyn_info["rms_dbfs"],
        "crest_factor_db": dyn_info["crest_factor_db"],
        "has_dc_offset": dc_info["has_dc_offset"],
        "dc_offset_val": dc_info["dc_offset_val"],
        "dc_offset_pct": dc_info["dc_offset_pct"],
        "has_sub_rumble": rumble_info["has_sub_rumble"],
        "sub_energy_ratio": rumble_info["sub_energy_ratio"],
        "is_exempt_sub_rumble": rumble_info["is_exempt"]
    }

if __name__ == "__main__":
    print("Testing Signal Metrics DSP Engine...")
    sr = 48000
    t = np.linspace(0, 1.0, sr, endpoint=False)

    # 1. Clean Sine Wave test (-6 dBFS)
    clean_sig = 0.5 * np.sin(2 * np.pi * 1000 * t)
    metrics_clean = analyze_track_signals(clean_sig, sr, "Vocal")
    print("Clean Sine:", metrics_clean)
    assert not metrics_clean["is_clipping"]
    assert -6.5 <= metrics_clean["peak_dbfs"] <= -5.5
    assert not metrics_clean["has_dc_offset"]
    assert not metrics_clean["has_sub_rumble"]

    # 2. Hard Clipped Signal test
    clipped_sig = np.clip(1.8 * np.sin(2 * np.pi * 440 * t), -1.0, 1.0)
    metrics_clipped = analyze_track_signals(clipped_sig, sr, "Lead Guitar")
    print("Clipped Signal:", metrics_clipped)
    assert metrics_clipped["is_clipping"] is True
    assert metrics_clipped["clamped_event_count"] > 0

    # 3. DC Offset Signal test
    dc_sig = 0.3 * np.sin(2 * np.pi * 440 * t) + 0.05
    metrics_dc = analyze_track_signals(dc_sig, sr, "Vocal")
    print("DC Offset Signal:", metrics_dc)
    assert metrics_dc["has_dc_offset"] is True
    assert metrics_dc["dc_offset_pct"] > 1.0

    # 4. Sub-Rumble Signal on Vocal test (20 Hz rumble)
    rumble_sig = 0.3 * np.sin(2 * np.pi * 1000 * t) + 0.4 * np.sin(2 * np.pi * 20 * t)
    metrics_rumble = analyze_track_signals(rumble_sig, sr, "Vocal")
    print("Vocal with Sub-Rumble:", metrics_rumble)
    assert metrics_rumble["has_sub_rumble"] is True

    # 5. Bass with Sub-Rumble (should be exempt)
    metrics_bass = analyze_track_signals(rumble_sig, sr, "Bass")
    print("Bass with Sub-Rumble (exempt):", metrics_bass)
    assert metrics_bass["has_sub_rumble"] is False

    print("✓ Signal Metrics PASSED All Tests!")
