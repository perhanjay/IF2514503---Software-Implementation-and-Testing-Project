"""
Phase T4: AI Engine Test Suite (Mel-Spectrogram, Instrument Classifier & Track Pairing)
========================================================================================
Mata Kuliah: IF2514503 - Software Implementation and Testing Project
Prinsip Pengujian: "Happy Path Last"
  1. Negative, Extreme Edge & Corruption Cases First
  2. Boundary & Calibration Edge Cases
  3. Happy Path Functional Verification Last
"""

import sys
import os
import numpy as np
import pytest

# Ensure worker/src is accessible in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from ai.mel_spectrogram import (
    hz_to_mel,
    mel_to_hz,
    create_mel_filterbank,
    extract_mel_spectrogram,
    extract_spectral_features
)
from ai.instrument_classifier import (
    INSTRUMENT_CLASSES,
    compute_filename_prior,
    compute_acoustic_scores,
    classify_track
)
from ai.pairing_detector import detect_track_pairs


# ============================================================================
# SECTION 1: NEGATIVE, EXTREME EDGE & CORRUPTION CASES (HAPPY PATH LAST)
# ============================================================================
class TestAINegativeAndExtremeCases:
    """Menguji ketahanan sistem AI terhadap input abnormal, sinyal korup, keheningan, dan derau."""

    def test_NV01_mel_spectrogram_pure_silence_all_zeros(self):
        """NV-01: Mel-Spectrogram harus mampu memproses sinyal hening (all zeros) tanpa ZeroDivisionError / NaN."""
        sr = 48000
        silent_audio = np.zeros(sr, dtype=np.float32)

        mel = extract_mel_spectrogram(silent_audio, sr, n_mels=128)
        assert mel.shape[0] == 128
        assert not np.isnan(mel).any(), "Mel spectrogram tidak boleh mengandung NaN"
        assert not np.isinf(mel).any(), "Mel spectrogram tidak boleh mengandung Inf"
        # Karena log10(max(..., 1e-10)), nilai terendah sekitar -100 dB
        assert np.all(mel <= -99.0), "Sinyal hening harus berada di dasar batas log floor (~ -100 dB)"

    def test_NV02_mel_spectrogram_ultra_short_signal_padding_guard(self):
        """NV-02: Mel-Spectrogram harus menangani sinyal yang lebih pendek dari n_fft (2048) tanpa crash ValueError."""
        sr = 48000
        # Hanya 128 sampel (< 2048 n_fft)
        tiny_audio = np.sin(np.linspace(0, 10, 128))

        mel = extract_mel_spectrogram(tiny_audio, sr, n_mels=128, n_fft=2048)
        assert mel.shape[0] == 128
        assert mel.shape[1] >= 1, "Harus menghasilkan minimal 1 frame waktu setelah padding"
        assert not np.isnan(mel).any()

    def test_NV03_spectral_features_empty_signal(self):
        """NV-03: Ekstraksi fitur spektral pada array kosong harus mengembalikan dict kosong tanpa exception."""
        empty_signal = np.array([], dtype=np.float32)
        features = extract_spectral_features(empty_signal, 48000)
        assert features == {}, "Fitur sinyal kosong harus mengembalikan dict kosong {}"

    def test_NV04_spectral_features_pure_dc_signal(self):
        """NV-04: Ekstraksi fitur pada sinyal konstan (DC offset murni) tidak boleh memicu pembagian nol."""
        sr = 48000
        dc_signal = np.ones(sr, dtype=np.float32) * 0.75
        features = extract_spectral_features(dc_signal, sr)

        assert "spectral_centroid_hz" in features
        assert not np.isnan(features["spectral_centroid_hz"])
        assert features["zcr"] == 0.0, "Sinyal DC datar tidak memiliki zero crossings"

    def test_NV05_spectral_features_nyquist_alternating_signal(self):
        """NV-05: Sinyal frekuensi ekstrim (pola selang-seling [-1, 1, -1, 1]) di batas Nyquist."""
        sr = 48000
        nyquist_signal = np.tile([1.0, -1.0], sr // 2)
        features = extract_spectral_features(nyquist_signal, sr)

        assert features["zcr"] > 0.95, "Zero crossing rate frekuensi Nyquist harus mendekati 1.0"
        assert features["spectral_centroid_hz"] > 20000, "Centroid harus berada di frekuensi sangat tinggi mendekati fs/2"

    def test_NV06_classifier_unrecognized_synthetic_white_noise(self):
        """NV-06: Klasifikasi derau acak (white noise) tanpa nama berkas deskriptif harus dievaluasi dengan aman."""
        np.random.seed(42)
        sr = 48000
        noise = np.random.uniform(-0.5, 0.5, sr)
        result = classify_track(noise, sr, file_name="unnamed_obscure_track_099.dat")

        assert result["detected_label"] in INSTRUMENT_CLASSES
        assert 0.0 <= result["confidence_score"] <= 1.0
        assert isinstance(result["needs_review"], bool)
        assert not np.isnan(result["confidence_score"])

    def test_NV07_pairing_detector_empty_and_single_track(self):
        """NV-07: Detektor pasangan instrumen harus mengembalikan list kosong jika trek kosong atau hanya 1 trek."""
        assert detect_track_pairs([]) == []
        assert detect_track_pairs([{"id": "t1", "fileName": "Kick.wav", "detectedLabel": "Drums: Kick"}]) == []

    def test_NV08_pairing_detector_unrelated_instruments_no_false_pairing(self):
        """NV-08: Tidak boleh menghasilkan pasangan palsu untuk instrumen yang sama sekali tidak berhubungan."""
        unrelated_tracks = [
            {"id": "t1", "fileName": "Lead_Vocal.wav", "detectedLabel": "Vocals: Lead"},
            {"id": "t2", "fileName": "Acoustic_Guitar.wav", "detectedLabel": "Guitars: Acoustic"},
            {"id": "t3", "fileName": "Synth_Pad.wav", "detectedLabel": "Keys / Synth"},
        ]
        pairs = detect_track_pairs(unrelated_tracks)
        assert len(pairs) == 0, "Instrumen vokal, gitar akustik, dan synth pad tidak boleh dipasangkan"


# ============================================================================
# SECTION 2: BOUNDARY & CALIBRATION EDGE CASES
# ============================================================================
class TestAIBoundaryAndCalibrationCases:
    """Menguji kondisi batas matematis, ambang batas kepastian (confidence < 0.80), dan multi-sample rate."""

    def test_ED01_mel_hz_scale_bijection(self):
        """ED-01: Skala Mel harus bersifat bijektif (round-trip hz -> mel -> hz kembali ke nilai asal)."""
        test_freqs = [20.0, 100.0, 440.0, 1000.0, 5000.0, 15000.0, 24000.0]
        for f in test_freqs:
            mel = hz_to_mel(f)
            recovered_f = mel_to_hz(mel)
            assert np.isclose(f, recovered_f, rtol=1e-5), f"Konversi Mel tidak konsisten pada {f} Hz"

    def test_ED02_filterbank_matrix_dimensions(self):
        """ED-02: Matriks filterbank Mel harus berukuran tepat (n_mels, n_fft // 2 + 1)."""
        n_mels = 128
        n_fft = 2048
        sr = 48000
        fb = create_mel_filterbank(n_mels, n_fft, sr)

        expected_shape = (128, 1025)
        assert fb.shape == expected_shape, f"Dimensi filterbank harus {expected_shape}, didapat {fb.shape}"
        assert np.all(fb >= 0.0), "Nilai koefisien filterbank segitiga tidak boleh bernilai negatif"

    def test_ED03_stereo_downmix_consistency(self):
        """ED-03: Input berkas audio stereo (2 channel) harus diturunkan ke mono tanpa perubahan dimensi 128 filterbank."""
        sr = 48000
        t = np.linspace(0, 1.0, sr, endpoint=False)
        ch_left = np.sin(2 * np.pi * 100 * t)
        ch_right = np.sin(2 * np.pi * 300 * t)
        stereo_audio = np.column_stack([ch_left, ch_right])

        mel = extract_mel_spectrogram(stereo_audio, sr, n_mels=128)
        assert mel.shape[0] == 128
        assert mel.shape[1] > 0
        assert not np.isnan(mel).any()

    def test_ED04_multi_sample_rate_invariance(self):
        """ED-04: Ekstraksi spektrogram harus bekerja konsisten pada berbagai laju sampel (44.1kHz, 48kHz, 96kHz)."""
        for sr in [44100, 48000, 96000]:
            t = np.linspace(0, 0.5, int(sr * 0.5), endpoint=False)
            audio = np.sin(2 * np.pi * 200 * t)
            mel = extract_mel_spectrogram(audio, sr, n_mels=128)
            assert mel.shape[0] == 128, f"Gagal mengekstrak 128 mel bins pada {sr} Hz"

    def test_ED05_confidence_threshold_flags_needs_review(self):
        """ED-05: Sinyal ambigu dengan confidence < 0.80 wajib menandai 'needs_review': True (UC-12)."""
        sr = 48000
        # Sinyal sine wave 1500 Hz murni dengan nama berkas generik tidak cocok kuat ke instrumen drum/bass manapun
        t = np.linspace(0, 1.0, sr, endpoint=False)
        flat_sine = np.sin(2 * np.pi * 1500 * t)
        result = classify_track(flat_sine, sr, file_name="track_stem_04.wav")

        if result["confidence_score"] < 0.80:
            assert result["needs_review"] is True, "Jika confidence < 0.80, wajib meminta peninjauan manual (needs_review = True)"
        else:
            assert result["needs_review"] is False

    def test_ED06_pairing_detector_mutual_exclusion(self):
        """ED-06: Detektor pasangan tidak boleh memasangkan track yang sama lebih dari satu kali."""
        triplet_tracks = [
            {"id": "kick1", "fileName": "Kick_In.wav", "detectedLabel": "Drums: Kick"},
            {"id": "kick2", "fileName": "Kick_Out.wav", "detectedLabel": "Drums: Kick"},
            {"id": "kick3", "fileName": "Kick_Sub.wav", "detectedLabel": "Drums: Kick"},
        ]
        pairs = detect_track_pairs(triplet_tracks)
        # Hanya boleh tepat 1 pasang (2 trek), 1 trek sisanya tidak boleh dipasangkan ulang
        assert len(pairs) == 1
        paired_ids = {pairs[0]["trackAId"], pairs[0]["trackBId"]}
        assert len(paired_ids) == 2


# ============================================================================
# SECTION 3: HAPPY PATH FUNCTIONAL VERIFICATION (LAST)
# ============================================================================
class TestAIHappyPathVerification:
    """Menguji fungsionalitas normal klasifikasi 12 instrumen dan deteksi pasangan mikrofon standar industri."""

    @pytest.fixture(autouse=True)
    def setup_audio_primitives(self):
        self.sr = 48000
        self.t = np.linspace(0, 1.5, int(self.sr * 1.5), endpoint=False)

    def test_HP01_kick_drum_acoustic_and_classifier(self):
        """HP-01: Klasifikasi Kick Drum (sub-bass 50Hz + transien peluruhan cepat) harus akurat dengan confidence >= 0.80."""
        # Sintesis sinyal Kick Drum: frekuensi menyapu ke bawah 80Hz -> 45Hz dengan peluruhan transien cepat
        decay = np.exp(-self.t * 10)
        kick_signal = np.sin(2 * np.pi * 50 * self.t) * decay

        result = classify_track(kick_signal, self.sr, file_name="01_Kick_In.wav")
        assert result["detected_label"] == "Drums: Kick"
        assert result["confidence_score"] >= 0.80
        assert result["needs_review"] is False
        assert result["spectral_summary"]["sub_energy_pct"] > 10.0

    def test_HP02_snare_drum_acoustic_and_classifier(self):
        """HP-02: Klasifikasi Snare Drum (mid-body 200Hz + derau jaring snare) harus akurat dengan confidence >= 0.80."""
        # Sintesis sinyal Snare: nada 220Hz + derau putih transien
        tone = np.sin(2 * np.pi * 220 * self.t) * np.exp(-self.t * 14)
        np.random.seed(123)
        noise = np.random.normal(0, 0.4, len(self.t)) * np.exp(-self.t * 12)
        snare_signal = tone + noise

        result = classify_track(snare_signal, self.sr, file_name="03_Snare_Top.wav")
        assert result["detected_label"] == "Drums: Snare"
        assert result["confidence_score"] >= 0.80
        assert result["needs_review"] is False

    def test_HP03_bass_di_harmonic_and_classifier(self):
        """HP-03: Klasifikasi Bass elektrik (nada dasar E1/82Hz + harmonik kuat) harus akurat dengan confidence >= 0.80."""
        f0 = 82.4  # E1 bass fundamental
        bass_signal = (
            np.sin(2 * np.pi * f0 * self.t)
            + 0.6 * np.sin(2 * np.pi * 2 * f0 * self.t)
            + 0.3 * np.sin(2 * np.pi * 3 * f0 * self.t)
        ) * np.exp(-self.t * 2)

        result = classify_track(bass_signal, self.sr, file_name="05_Bass_DI.wav")
        assert result["detected_label"] == "Bass"
        assert result["confidence_score"] >= 0.80
        assert result["needs_review"] is False

    def test_HP04_overhead_cymbals_acoustic_and_classifier(self):
        """HP-04: Klasifikasi Cymbals / Overhead (energi frekuensi tinggi/air band dominan)."""
        # Sintesis suara simbal frekuensi tinggi (> 6000 Hz)
        np.random.seed(99)
        cymbals_signal = np.random.normal(0, 0.3, len(self.t)) * np.exp(-self.t * 3)

        result = classify_track(cymbals_signal, self.sr, file_name="07_Overhead_L.wav")
        assert result["detected_label"] in ["Drums: Overhead", "Drums: Hi-Hat"]
        assert result["confidence_score"] >= 0.70

    def test_HP05_complete_multitrack_session_pairing(self):
        """HP-05: Deteksi otomatis 4 jenis pasangan instrumen studio standar pada sesi multitrack lengkap (UC-12)."""
        session_tracks = [
            {"id": "trk-1", "fileName": "01_Kick_In.wav", "detectedLabel": "Drums: Kick"},
            {"id": "trk-2", "fileName": "02_Kick_Out.wav", "detectedLabel": "Drums: Kick"},
            {"id": "trk-3", "fileName": "03_Snare_Top.wav", "detectedLabel": "Drums: Snare"},
            {"id": "trk-4", "fileName": "04_Snare_Bottom.wav", "detectedLabel": "Drums: Snare"},
            {"id": "trk-5", "fileName": "05_Bass_DI.wav", "detectedLabel": "Bass"},
            {"id": "trk-6", "fileName": "06_Bass_Amp_Mic.wav", "detectedLabel": "Bass"},
            {"id": "trk-7", "fileName": "07_Overhead_Left.wav", "detectedLabel": "Drums: Overhead"},
            {"id": "trk-8", "fileName": "08_Overhead_Right.wav", "detectedLabel": "Drums: Overhead"},
            {"id": "trk-9", "fileName": "09_Lead_Vocal.wav", "detectedLabel": "Vocals: Lead"}
        ]

        detected_pairs = detect_track_pairs(session_tracks)
        assert len(detected_pairs) == 4, f"Harus mendeteksi tepat 4 pasang instrumen, ditemukan: {len(detected_pairs)}"

        pair_types = [p["pairType"] for p in detected_pairs]
        assert "MIC_PAIR" in pair_types, "Kick In & Out harus terdeteksi sebagai MIC_PAIR"
        assert "DRUM_TOP_BOTTOM" in pair_types, "Snare Top & Bottom harus terdeteksi sebagai DRUM_TOP_BOTTOM"
        assert "BASS_DI_MIC" in pair_types, "Bass DI & Amp harus terdeteksi sebagai BASS_DI_MIC"
        assert "STEREO_SPLIT" in pair_types, "Overhead L & R harus terdeteksi sebagai STEREO_SPLIT"

        for pair in detected_pairs:
            assert pair["confidence"] >= 0.90, "Confidence pasangan mikrofon fisik harus >= 90%"
            assert len(pair["reason"]) > 0
