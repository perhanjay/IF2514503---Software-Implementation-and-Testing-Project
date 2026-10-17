import numpy as np
import scipy.signal

def compute_stereo_correlation(left, right):
    """
    Computes Pearson correlation coefficient between Left and Right channels:
    r in [-1.0, +1.0]
    +1.0 = Pure mono / perfect in-phase
     0.0 = Wide decorrelated stereo
    -1.0 = Pure out-of-phase / 180 deg inverted (complete cancellation on mono sum)
    """
    if len(left) == 0 or len(right) == 0:
        return 1.0

    mean_l = np.mean(left)
    mean_r = np.mean(right)
    diff_l = left - mean_l
    diff_r = right - mean_r

    denom = np.sqrt(np.sum(diff_l ** 2) * np.sum(diff_r ** 2))
    if denom < 1e-12:
        return 1.0

    r = np.sum(diff_l * diff_r) / denom
    return float(np.clip(r, -1.0, 1.0))

def compute_mono_cancellation_loss(left, right):
    """
    Measures dB energy loss when stereo signal is summed to mono:
    Loss dB = 20 * log10(RMS(Mono) / RMS(Stereo))
    If loss < -3 dB or negative, significant phase cancellation occurs.
    """
    stereo_rms = np.sqrt(0.5 * (np.mean(left ** 2) + np.mean(right ** 2))) + 1e-12
    mono_sum = 0.5 * (left + right)
    mono_rms = np.sqrt(np.mean(mono_sum ** 2)) + 1e-12

    loss_db = 20.0 * np.log10(mono_rms / stereo_rms)
    return float(loss_db)

def detect_fake_stereo(left, right, sample_rate):
    """
    Detects artificial Fake Stereo (Haas Effect, pseudo-stereo delay):
    - When one channel is a delayed copy of another (delay 1ms - 35ms).
    - Or extreme phase inversion on side channel causing mono collapse.
    """
    # 1. Mid/Side energy ratio
    mid = 0.5 * (left + right)
    side = 0.5 * (left - right)
    mid_energy = np.sum(mid ** 2) + 1e-12
    side_energy = np.sum(side ** 2) + 1e-12
    ms_ratio = side_energy / mid_energy

    # 2. Cross-correlation between L and R across Haas delay lags (1ms to 35ms)
    min_lag = max(1, int(sample_rate * 0.001))   # 1 ms
    max_lag = min(len(left) - 1, int(sample_rate * 0.035))  # 35 ms

    max_pts = min(len(left), sample_rate * 5)
    sig_l = left[:max_pts] - np.mean(left[:max_pts])
    sig_r = right[:max_pts] - np.mean(right[:max_pts])

    norm_l = np.sqrt(np.sum(sig_l ** 2)) + 1e-12
    norm_r = np.sqrt(np.sum(sig_r ** 2)) + 1e-12

    cc = scipy.signal.correlate(sig_l, sig_r, mode='full')
    mid_idx = len(cc) // 2
    norm_cc = cc / (norm_l * norm_r)

    has_haas_delay = False
    detected_delay_ms = 0.0

    if mid_idx + max_lag < len(norm_cc) and mid_idx - max_lag >= 0:
        pos_lags = norm_cc[mid_idx + min_lag : mid_idx + max_lag]
        neg_lags = norm_cc[mid_idx - max_lag : mid_idx - min_lag]

        max_pos = np.max(pos_lags) if len(pos_lags) > 0 else 0
        max_neg = np.max(neg_lags) if len(neg_lags) > 0 else 0
        zero_lag_corr = norm_cc[mid_idx]

        # In Haas pseudo-stereo, delayed peak is dominant compared to zero lag
        if (max_pos > 0.55 or max_neg > 0.55) and (zero_lag_corr < 0.70 or abs(max(max_pos, max_neg) - zero_lag_corr) > 0.15):
            has_haas_delay = True
            peak_lag = min_lag + (np.argmax(pos_lags) if max_pos >= max_neg else np.argmax(neg_lags))
            detected_delay_ms = float((peak_lag / sample_rate) * 1000.0)

    # Severe mono cancellation check
    cancellation_db = compute_mono_cancellation_loss(left, right)
    has_fake_stereo = bool(has_haas_delay or (cancellation_db < -4.5 and ms_ratio > 1.0))

    return {
        "has_fake_stereo": has_fake_stereo,
        "is_haas_effect": has_haas_delay,
        "haas_delay_ms": round(detected_delay_ms, 2),
        "ms_ratio": round(float(ms_ratio), 3),
        "cancellation_db": round(float(cancellation_db), 2)
    }

def analyze_track_pair_phase(sig_a, sig_b, sample_rate, pair_type="MIC_PAIR"):
    """
    Analyzes physical phase interaction between paired multi-mic tracks:
    (e.g. Snare Top vs Bottom, Kick In vs Sub, Bass DI vs Mic)
    Returns:
    - correlation_coeff
    - has_polarity_invert (True if signals are 180 deg out of phase)
    - delay_samples & delay_ms
    - has_comb_filtering (True if micro-delay is causing phase cancellation)
    """
    if sig_a.ndim > 1:
        s_a = np.mean(sig_a, axis=1)
    else:
        s_a = sig_a

    if sig_b.ndim > 1:
        s_b = np.mean(sig_b, axis=1)
    else:
        s_b = sig_b

    min_len = min(len(s_a), len(s_b))
    max_pts = min(min_len, sample_rate * 5)

    x = s_a[:max_pts] - np.mean(s_a[:max_pts])
    y = s_b[:max_pts] - np.mean(s_b[:max_pts])

    norm_x = np.sqrt(np.sum(x ** 2)) + 1e-12
    norm_y = np.sqrt(np.sum(y ** 2)) + 1e-12

    # Zero-lag correlation
    zero_corr = float(np.sum(x * y) / (norm_x * norm_y))

    # Cross-correlation across +/- 20ms search window
    max_lag = int(sample_rate * 0.020)
    cc = scipy.signal.correlate(x, y, mode='full')
    mid_idx = len(cc) // 2

    window_cc = cc[max(0, mid_idx - max_lag) : min(len(cc), mid_idx + max_lag + 1)]
    norm_window = window_cc / (norm_x * norm_y)

    abs_window = np.abs(norm_window)
    best_idx = np.argmax(abs_window)
    best_corr = float(norm_window[best_idx])
    lag_samples = int(best_idx - (len(norm_window) // 2))
    lag_ms = float((lag_samples / sample_rate) * 1000.0)

    # Polarity Inversion: If Snare Top/Bottom or Kick In/Out has negative correlation
    has_polarity_invert = bool(best_corr < -0.35 or zero_corr < -0.40)

    # Comb filtering: When non-zero delay between 0.15ms and 15ms is present with high correlation
    has_comb_filtering = bool(abs(lag_ms) >= 0.15 and abs(lag_ms) <= 15.0 and abs(best_corr) > 0.40)

    return {
        "correlation": round(zero_corr, 3),
        "peak_correlation": round(best_corr, 3),
        "has_polarity_invert": has_polarity_invert,
        "delay_samples": lag_samples,
        "delay_ms": round(lag_ms, 2),
        "has_comb_filtering": has_comb_filtering
    }

if __name__ == "__main__":
    print("Testing Phase Analyzer...")
    sr = 48000
    t = np.linspace(0, 1.0, sr, endpoint=False)

    # Test 1: Inverted polarity pair (-1.0 correlation)
    sig1 = np.sin(2 * np.pi * 100 * t)
    sig2 = -1.0 * sig1
    pair_res = analyze_track_pair_phase(sig1, sig2, sr, "DRUM_TOP_BOTTOM")
    print("Inverted Pair Result:", pair_res)
    assert pair_res["has_polarity_invert"] is True
    assert pair_res["correlation"] <= -0.99

    # Test 2: Haas effect fake stereo (12ms delay on guitar transient/noise)
    l_chan = np.sin(2 * np.pi * 180 * t) * np.exp(-t * 6) + np.random.normal(0, 0.2, sr) * np.exp(-t * 10)
    delay_samples = int(sr * 0.012)
    r_chan = np.zeros_like(l_chan)
    r_chan[delay_samples:] = l_chan[:-delay_samples]
    fake_res = detect_fake_stereo(l_chan, r_chan, sr)
    print("Fake Stereo Result:", fake_res)
    assert fake_res["has_fake_stereo"] is True
    assert 11.0 <= fake_res["haas_delay_ms"] <= 13.0

    print("✓ Phase Analyzer PASSED")
