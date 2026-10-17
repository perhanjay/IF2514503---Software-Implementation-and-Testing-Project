import numpy as np
import scipy.signal
import soundfile as sf
import os
import sys

def hz_to_mel(hz):
    """Convert Hz to Mel scale."""
    return 2595.0 * np.log10(1.0 + hz / 700.0)

def mel_to_hz(mel):
    """Convert Mel scale to Hz."""
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)

def create_mel_filterbank(n_mels, n_fft, sample_rate, f_min=20.0, f_max=None):
    """
    Constructs triangular Mel filterbank matrix.
    Shape: (n_mels, n_fft // 2 + 1)
    """
    if f_max is None:
        f_max = sample_rate / 2.0

    mel_min = hz_to_mel(f_min)
    mel_max = hz_to_mel(f_max)
    mel_points = np.linspace(mel_min, mel_max, n_mels + 2)
    hz_points = mel_to_hz(mel_points)

    bins = np.floor((n_fft + 1) * hz_points / sample_rate).astype(int)
    n_freqs = n_fft // 2 + 1
    filterbank = np.zeros((n_mels, n_freqs))

    for m in range(1, n_mels + 1):
        f_left = bins[m - 1]
        f_center = bins[m]
        f_right = bins[m + 1]

        if f_center > f_left:
            filterbank[m - 1, f_left:f_center] = (
                np.arange(f_left, f_center) - f_left
            ) / (f_center - f_left)
        if f_right > f_center:
            filterbank[m - 1, f_center:f_right] = (
                f_right - np.arange(f_center, f_right)
            ) / (f_right - f_center)

    return filterbank

def extract_mel_spectrogram(audio_data, sample_rate, n_mels=128, n_fft=2048, hop_length=512):
    """
    Computes log Mel-Spectrogram from audio waveform.
    Returns: (n_mels, time_frames) in dB.
    """
    # Downmix to mono if stereo
    if audio_data.ndim > 1:
        signal = np.mean(audio_data, axis=1)
    else:
        signal = audio_data

    # Zero-pad if signal length is shorter than n_fft (prevents ValueError: nperseg > length)
    if len(signal) < n_fft:
        signal = np.pad(signal, (0, n_fft - len(signal)), mode='constant')

    # STFT using Hann window
    f, t, Zxx = scipy.signal.stft(
        signal,
        fs=sample_rate,
        window='hann',
        nperseg=n_fft,
        noverlap=n_fft - hop_length,
        boundary=None,
        padded=False
    )

    power_spec = np.abs(Zxx) ** 2
    mel_fb = create_mel_filterbank(n_mels, n_fft, sample_rate)
    mel_spec = np.dot(mel_fb, power_spec)

    # Log compression to dB scale
    log_mel = 10.0 * np.log10(np.maximum(mel_spec, 1e-10))
    return log_mel

def extract_spectral_features(audio_data, sample_rate):
    """
    Extracts physically grounded acoustic audio features for instrument recognition:
    - Energy distribution across 5 frequency bands (Sub, Low, Mid, High-Mid, Air)
    - Spectral Centroid
    - Spectral Rolloff (85%)
    - Zero Crossing Rate (ZCR)
    - Transient Sharpness (Crest Factor & Peak-to-RMS)
    - Harmonic Pitch Periodicity Proxy
    """
    if audio_data.ndim > 1:
        mono_signal = np.mean(audio_data, axis=1)
    else:
        mono_signal = audio_data

    total_samples = len(mono_signal)
    if total_samples == 0:
        return {}

    # 1. Take a representative chunk (up to 15 seconds) to keep computation instant
    max_samples = min(total_samples, sample_rate * 15)
    sig_slice = mono_signal[:max_samples]

    # Normalize amplitude
    peak_val = np.max(np.abs(sig_slice))
    if peak_val > 0:
        sig_slice = sig_slice / peak_val

    # 2. Fast Fourier Transform & Power Spectrum
    fft_vals = np.abs(np.fft.rfft(sig_slice * np.hanning(len(sig_slice))))
    freqs = np.fft.rfftfreq(len(sig_slice), 1.0 / sample_rate)
    power = fft_vals ** 2
    total_power = np.sum(power) + 1e-12

    # 3. Energy across frequency bands
    sub_mask = (freqs >= 20) & (freqs < 60)
    low_mask = (freqs >= 60) & (freqs < 250)
    mid_mask = (freqs >= 250) & (freqs < 2500)
    high_mid_mask = (freqs >= 2500) & (freqs < 6000)
    air_mask = (freqs >= 6000) & (freqs <= sample_rate / 2.0)

    sub_energy = np.sum(power[sub_mask]) / total_power
    low_energy = np.sum(power[low_mask]) / total_power
    mid_energy = np.sum(power[mid_mask]) / total_power
    high_mid_energy = np.sum(power[high_mid_mask]) / total_power
    air_energy = np.sum(power[air_mask]) / total_power

    # 4. Spectral Centroid (mean frequency)
    spectral_centroid = np.sum(freqs * power) / total_power

    # 5. Spectral Rolloff (85% energy frequency)
    cum_power = np.cumsum(power)
    rolloff_idx = np.searchsorted(cum_power, 0.85 * total_power)
    spectral_rolloff = freqs[min(rolloff_idx, len(freqs) - 1)]

    # 6. Zero Crossing Rate (ZCR)
    zero_crossings = np.sum(np.abs(np.diff(np.sign(sig_slice))) > 0)
    zcr = zero_crossings / len(sig_slice)

    # 7. Transient Peak-to-RMS (Crest Factor in dB)
    rms = np.sqrt(np.mean(sig_slice ** 2)) + 1e-12
    peak = float(np.max(np.abs(sig_slice))) if len(sig_slice) > 0 else 0.0
    crest_factor_db = 20.0 * np.log10(max(peak / rms, 1.0)) if peak > 0.0 else 0.0

    # 8. Transient Attack Sharpness
    frame_len = int(sample_rate * 0.02)  # 20ms frames
    hop = frame_len // 2
    n_frames = max(1, (len(sig_slice) - frame_len) // hop)
    frame_energies = [
        np.sum(sig_slice[i * hop : i * hop + frame_len] ** 2)
        for i in range(n_frames)
    ]
    frame_diffs = np.diff(frame_energies) if len(frame_energies) > 1 else [0]
    attack_sharpness = float(np.max(frame_diffs)) if len(frame_diffs) > 0 else 0.0

    # 9. Autocorrelation Pitch Periodicity
    autocorr = scipy.signal.correlate(sig_slice[:sample_rate], sig_slice[:sample_rate], mode='full')
    autocorr = autocorr[len(autocorr)//2:]
    min_lag = int(sample_rate / 1000)
    max_lag = int(sample_rate / 40)
    if max_lag < len(autocorr):
        norm_autocorr = autocorr[min_lag:max_lag] / (autocorr[0] + 1e-12)
        harmonicity = float(np.max(norm_autocorr)) if len(norm_autocorr) > 0 else 0.0
    else:
        harmonicity = 0.0

    return {
        "sub_energy_ratio": float(sub_energy),
        "low_energy_ratio": float(low_energy),
        "mid_energy_ratio": float(mid_energy),
        "high_mid_energy_ratio": float(high_mid_energy),
        "air_energy_ratio": float(air_energy),
        "spectral_centroid_hz": float(spectral_centroid),
        "spectral_rolloff_hz": float(spectral_rolloff),
        "zcr": float(zcr),
        "crest_factor_db": float(crest_factor_db),
        "attack_sharpness": float(attack_sharpness),
        "harmonicity": float(harmonicity)
    }

if __name__ == "__main__":
    print("Testing Mel-Spectrogram & Feature Extractor...")
    sr = 48000
    t = np.linspace(0, 1.0, sr, endpoint=False)
    test_kick = np.sin(2 * np.pi * 50 * t) * np.exp(-t * 8)
    kick_feats = extract_spectral_features(test_kick, sr)
    print("Kick Features:", {k: round(v, 4) for k, v in kick_feats.items()})

    mel = extract_mel_spectrogram(test_kick, sr)
    print(f"Mel-Spectrogram Shape: {mel.shape} (128 bands x time frames)")
    assert mel.shape[0] == 128
    print("✓ Mel-Spectrogram Extraction PASSED")
