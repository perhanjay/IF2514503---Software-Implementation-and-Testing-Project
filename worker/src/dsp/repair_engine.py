import numpy as np
import scipy.signal

def flip_polarity(audio_data):
    """
    FR-5.1: Flips audio polarity by 180 degrees (y = -x).
    Resolves out-of-phase mic cancellation and inverted stereo stems.
    """
    return -1.0 * audio_data

def eliminate_dc_offset(audio_data, sample_rate=44100):
    """
    FR-5.5: Removes DC bias from signal so waveform oscillates around 0.0.
    Subtracts channel mean to restore full headroom and prevent click/pop artifacts.
    """
    if len(audio_data) == 0:
        return audio_data

    if audio_data.ndim == 1:
        mean_val = np.mean(audio_data)
        return audio_data - mean_val
    elif audio_data.ndim == 2:
        cleaned = np.copy(audio_data)
        for ch in range(audio_data.shape[1]):
            mean_val = np.mean(cleaned[:, ch])
            cleaned[:, ch] -= mean_val
        return cleaned
    return audio_data

def collapse_to_true_mono(audio_data):
    """
    FR-5.3: Converts destructive fake stereo (Haas delay / phase offset)
    back to true mono: M = 0.5 * (L + R) duplicated across both channels.
    Eliminates comb filtering and guarantees 100% mono compatibility.
    """
    if len(audio_data) == 0:
        return audio_data

    if audio_data.ndim == 2 and audio_data.shape[1] >= 2:
        mono = 0.5 * (audio_data[:, 0] + audio_data[:, 1])
        return np.column_stack([mono, mono])
    return audio_data

def filter_sub_rumble(audio_data, sample_rate, cutoff_hz=35.0):
    """
    FR-5.6: Applies a 2nd-order Butterworth High-Pass Filter at cutoff_hz (default 35 Hz)
    to clean inaudible subsonic rumble on non-bass tracks (vocals, guitars, keys, drums).
    """
    if len(audio_data) == 0:
        return audio_data

    if sample_rate <= 0:
        sample_rate = 44100
        
    nyquist = 0.5 * sample_rate
    normalized_cutoff = min(cutoff_hz / nyquist, 0.99)
    if normalized_cutoff <= 0.001:
        return audio_data

    sos = scipy.signal.butter(2, normalized_cutoff, btype='highpass', output='sos')
    
    if audio_data.ndim == 1:
        return scipy.signal.sosfilt(sos, audio_data).astype(np.float32)
    elif audio_data.ndim == 2:
        return scipy.signal.sosfilt(sos, audio_data, axis=0).astype(np.float32)
    return audio_data

def align_pair_microdelay(track_a_audio, track_b_audio, sample_rate, max_delay_ms=25.0):
    """
    FR-5.2: Detects and aligns inter-mic micro-delay between dual microphone pairs
    (e.g., Snare Top vs Bottom, Kick In vs Out) via normalized cross-correlation.
    Shifts track_b to maximize coherence with track_a while preserving exact zero-aligned duration.
    """
    if len(track_a_audio) == 0 or len(track_b_audio) == 0:
        return track_b_audio, 0, 0.0

    # Get mono representation for correlation analysis
    a_mono = track_a_audio[:, 0] if track_a_audio.ndim == 2 else track_a_audio
    b_mono = track_b_audio[:, 0] if track_b_audio.ndim == 2 else track_b_audio

    # Analyze up to 10 seconds of active signal to optimize computation
    max_len = min(len(a_mono), len(b_mono), int(sample_rate * 10))
    a_slice = a_mono[:max_len]
    b_slice = b_mono[:max_len]

    max_lag_samples = int(sample_rate * (max_delay_ms / 1000.0))
    if max_lag_samples <= 0:
        return track_b_audio, 0, 0.0

    corr = scipy.signal.correlate(a_slice, b_slice, mode='full')
    lags = scipy.signal.correlation_lags(len(a_slice), len(b_slice), mode='full')

    # Restrict search within [-max_lag_samples, max_lag_samples]
    valid_idx = np.where((lags >= -max_lag_samples) & (lags <= max_lag_samples))[0]
    if len(valid_idx) == 0:
        return track_b_audio, 0, 0.0

    valid_corr = corr[valid_idx]
    best_idx = valid_idx[np.argmax(valid_corr)]
    # In scipy correlate(a, b), if b is delayed by D, peak is at lag = -D
    # We define delay_samples as positive when Track B is delayed relative to Track A
    delay_samples = int(-lags[best_idx])
    delay_ms = float((delay_samples / sample_rate) * 1000.0)

    # Shift track_b by delay_samples
    shifted_b = np.zeros_like(track_b_audio)
    n_samples = len(track_b_audio)

    if delay_samples > 0:
        # Track B was delayed -> advance it (shift left)
        shifted_b[:n_samples - delay_samples] = track_b_audio[delay_samples:]
    elif delay_samples < 0:
        # Track B was ahead -> delay it (shift right)
        abs_lag = abs(delay_samples)
        shifted_b[abs_lag:] = track_b_audio[:n_samples - abs_lag]
    else:
        shifted_b = np.copy(track_b_audio)

    return shifted_b, delay_samples, delay_ms

def apply_gain_staging(audio_data, target_peak_dbfs=-3.0, max_gain_db=12.0):
    """
    FR-5.7: Normalizes stem peak headroom to optimal mixing stage level (-3.0 dBFS).
    Attenuates digital clipping (> -0.1 dBFS) and boosts excessively quiet stems safely.
    Guarantees no clipping occurs post-repair.
    """
    if len(audio_data) == 0:
        return audio_data

    current_peak = float(np.max(np.abs(audio_data)))
    if current_peak < 1e-6:
        return audio_data  # Silence, leave as-is

    current_peak_dbfs = 20.0 * np.log10(current_peak)
    target_linear = 10.0 ** (target_peak_dbfs / 20.0)

    # Calculate desired gain factor
    gain_factor = target_linear / current_peak

    # Prevent boosting background noise excessively (clamp to +12 dB boost)
    max_linear_boost = 10.0 ** (max_gain_db / 20.0)
    if gain_factor > max_linear_boost:
        gain_factor = max_linear_boost

    staged_audio = audio_data * gain_factor
    # Hard clamp to -0.9999 / +0.9999 to guarantee zero inter-sample digital overs
    return np.clip(staged_audio, -0.9999, 0.9999).astype(np.float32)

def execute_track_repairs(
    audio_data,
    sample_rate,
    instrument_label="Other",
    options=None,
    pair_lag_samples=0
):
    """
    Orchestrates DSP repair transformations for a single track based on options.
    Options format:
    {
        "flipPolarity": bool,
        "alignDelay": bool,
        "fixFakeStereo": bool,
        "removeDcOffset": bool,
        "filterSubRumble": bool,
        "gainStaging": bool
    }
    """
    if options is None:
        options = {
            "flipPolarity": False,
            "alignDelay": False,
            "fixFakeStereo": False,
            "removeDcOffset": True,
            "filterSubRumble": True,
            "gainStaging": True
        }

    repaired = np.copy(audio_data).astype(np.float32)
    actions_applied = []

    # 1. DC Offset Elimination (FR-5.5)
    if options.get("removeDcOffset", True):
        mean_offset = float(np.max(np.abs(np.mean(repaired, axis=0))))
        if mean_offset > 0.001:
            repaired = eliminate_dc_offset(repaired, sample_rate)
            actions_applied.append("DC Offset Eliminated")

    # 2. Polarity Flip (FR-5.1)
    if options.get("flipPolarity", False):
        repaired = flip_polarity(repaired)
        actions_applied.append("Polarity Inverted (180°)")

    # 3. Inter-mic Delay Compensation (FR-5.2)
    if options.get("alignDelay", False) and pair_lag_samples != 0:
        n_samples = len(repaired)
        shifted = np.zeros_like(repaired)
        if pair_lag_samples > 0:
            shifted[:n_samples - pair_lag_samples] = repaired[pair_lag_samples:]
        elif pair_lag_samples < 0:
            abs_lag = abs(pair_lag_samples)
            shifted[abs_lag:] = repaired[:n_samples - abs_lag]
        repaired = shifted
        delay_ms = round((pair_lag_samples / sample_rate) * 1000.0, 2)
        actions_applied.append(f"Micro-delay Aligned ({delay_ms} ms)")

    # 4. Fake Stereo to True Mono (FR-5.3)
    if options.get("fixFakeStereo", False):
        repaired = collapse_to_true_mono(repaired)
        actions_applied.append("Collapsed Fake Stereo to True Mono")

    # 5. Sub-rumble High-pass Filter (FR-5.6)
    label_lower = (instrument_label or "").lower()
    is_bass_inst = any(k in label_lower for k in ["bass", "kick", "sub", "808"])
    if options.get("filterSubRumble", True) and not is_bass_inst:
        repaired = filter_sub_rumble(repaired, sample_rate, cutoff_hz=35.0)
        actions_applied.append("Sub-Rumble High-Pass Filter (<35 Hz)")

    # 6. Gain Staging & Headroom Staging (FR-5.7)
    if options.get("gainStaging", True):
        repaired = apply_gain_staging(repaired, target_peak_dbfs=-3.0)
        actions_applied.append("Headroom Staged to -3.0 dBFS Peak")

    return repaired, actions_applied
