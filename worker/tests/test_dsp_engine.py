"""
Phase T5: Core DSP Math & Health Score Engine Test Suite
=========================================================
Mata Kuliah: IF2514503 - Software Implementation and Testing Project
Prinsip Pengujian: "Happy Path Last"
  1. Negative, Extreme Mathematical Corruption & Anomaly Cases First
  2. Boundary & Calibration Edge Cases (DC threshold, ISP oversampling, Haas delay window)
  3. Happy Path Functional Verification Last (Clean audio, recommendations, session health score)
"""

import sys
import os
import numpy as np
import pytest

# Ensure worker/src is accessible in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from dsp.phase_analyzer import (
    compute_stereo_correlation,
    compute_mono_cancellation_loss,
    detect_fake_stereo,
    analyze_track_pair_phase
)
from dsp.signal_metrics import (
    compute_true_peak,
    detect_clipping,
    compute_crest_factor_and_dynamics,
    detect_dc_offset,
    detect_sub_rumble,
    analyze_track_signals
)
from dsp.health_score import (
    generate_track_recommendations,
    calculate_track_health,
    calculate_session_health,
    PENALTY_WEIGHTS
)


# ============================================================================
# SECTION 1: NEGATIVE, EXTREME ANOMALY & CORRUPTION CASES (HAPPY PATH LAST)
# ============================================================================
class TestDSPNegativeAndExtremeCases:
    """Menguji ketahanan modul DSP terhadap sinyal kosong, nol, pembagian nol, dan anomali ekstrim."""

    def test_NV01_empty_signals_graceful_handling(self):
        """NV-01: Seluruh fungsi metrik sinyal DSP harus menangani array kosong [] tanpa ZeroDivisionError."""
        empty_audio = np.array([], dtype=np.float32)

        # 1. True Peak & Clipping
        tp_dbfs, linear_pk = compute_true_peak(empty_audio, 48000)
        assert tp_dbfs <= -100.0
        assert linear_pk == 0.0

        # 2. Crest factor & dynamics
        dyn = compute_crest_factor_and_dynamics(empty_audio)
        assert dyn["crest_factor_db"] == 0.0
        assert dyn["peak_dbfs"] <= -100.0

        # 3. DC offset
        dc = detect_dc_offset(empty_audio)
        assert dc["has_dc_offset"] is False
        assert dc["dc_offset_val"] == 0.0

        # 4. Sub rumble
        rumble = detect_sub_rumble(empty_audio, 48000, "VOCAL")
        assert rumble["has_sub_rumble"] is False

        # 5. Stereo correlation
        corr = compute_stereo_correlation(empty_audio, empty_audio)
        assert corr == 1.0

    def test_NV02_pure_silence_all_zeros_no_division_by_zero(self):
        """NV-02: Sinyal hening total (all zeros) tidak boleh memicu pembagian nol pada korelasi Pearson."""
        sr = 48000
        silence = np.zeros(sr, dtype=np.float32)

        corr = compute_stereo_correlation(silence, silence)
        assert corr == 1.0

        loss = compute_mono_cancellation_loss(silence, silence)
        assert not np.isnan(loss)
        assert not np.isinf(loss)

    def test_NV03_extreme_dc_offset_100_percent(self):
        """NV-03: Sinyal konstan DC murni bernilai +1.0 (DC bias 100%)."""
        sr = 48000
        extreme_dc = np.ones(sr, dtype=np.float32)

        dc_res = detect_dc_offset(extreme_dc, threshold=0.005)
        assert dc_res["has_dc_offset"] is True
        assert np.isclose(dc_res["dc_offset_val"], 1.0, atol=1e-3)
        assert np.isclose(dc_res["dc_offset_pct"], 100.0, atol=1e-1)

    def test_NV04_hard_digital_clipping_detection(self):
        """NV-04: Sinyal kotak terpotong (hard clipped) dengan ribuan sampel terjepit di 1.0."""
        sr = 48000
        t = np.linspace(0, 1.0, sr, endpoint=False)
        clipped_sig = np.clip(2.5 * np.sin(2 * np.pi * 440 * t), -1.0, 1.0)

        clip_res = detect_clipping(clipped_sig, sr, threshold_dbfs=-0.1, consecutive_samples=3)
        assert clip_res["is_clipping"] is True
        assert clip_res["clamped_event_count"] > 100
        assert clip_res["max_consecutive_clamped"] >= 3
        assert clip_res["true_peak_dbfs"] >= -0.05

    def test_NV05_subsonic_rumble_and_instrument_exemption(self):
        """NV-05: Sinyal rumble 15 Hz harus terdeteksi pada Vokal/Gitar, namun dibebaskan (exempt) pada Bass/Kick."""
        sr = 48000
        t = np.linspace(0, 1.0, sr, endpoint=False)
        # 15 Hz rumble kuat dicampur sedikit nada 1000 Hz
        rumble_signal = 0.6 * np.sin(2 * np.pi * 15 * t) + 0.2 * np.sin(2 * np.pi * 1000 * t)

        # 1. Pada trek Vokal: harus memicu deteksi rumble
        vocal_res = detect_sub_rumble(rumble_signal, sr, instrument_label="Vocals: Lead")
        assert vocal_res["has_sub_rumble"] is True
        assert vocal_res["is_exempt"] is False
        assert vocal_res["sub_energy_ratio"] > 0.04

        # 2. Pada trek Bass: instrumen bass memang membutuhkan frekuensi rendah, maka harus dibebaskan
        bass_res = detect_sub_rumble(rumble_signal, sr, instrument_label="Bass")
        assert bass_res["has_sub_rumble"] is False
        assert bass_res["is_exempt"] is True

        # 3. Pada trek Kick Drum: juga harus dibebaskan
        kick_res = detect_sub_rumble(rumble_signal, sr, instrument_label="Drums: Kick")
        assert kick_res["has_sub_rumble"] is False
        assert kick_res["is_exempt"] is True

    def test_NV06_polarity_inverted_phase_cancellation(self):
        """NV-06: Sepasang sinyal dengan polaritas 180° terbalik harus menghasilkan korelasi mendekati -1.0."""
        sr = 48000
        t = np.linspace(0, 1.0, sr, endpoint=False)
        sig_a = np.sin(2 * np.pi * 150 * t)
        sig_b = -1.0 * sig_a  # 180 deg invert

        pair_res = analyze_track_pair_phase(sig_a, sig_b, sr, pair_type="DRUM_TOP_BOTTOM")
        assert pair_res["has_polarity_invert"] is True
        assert pair_res["correlation"] <= -0.99
        assert pair_res["delay_samples"] == 0

        # Loss saat dijumlahkan ke mono harus sangat besar (cancellation loss < -40 dB)
        cancellation_db = compute_mono_cancellation_loss(sig_a, sig_b)
        assert cancellation_db < -40.0

    def test_NV07_haas_effect_fake_stereo_detection(self):
        """NV-07: Sinyal stereo artifisial Haas effect (delay 12 ms antar kanal) harus terdeteksi sebagai fake stereo."""
        sr = 48000
        t = np.linspace(0, 1.0, sr, endpoint=False)
        # Sinyal akustik dengan transien peluruhan nyata
        l_chan = np.sin(2 * np.pi * 180 * t) * np.exp(-t * 6) + np.random.normal(0, 0.2, sr) * np.exp(-t * 10)

        delay_samples = int(sr * 0.012)  # 12 ms delay
        r_chan = np.zeros_like(l_chan)
        r_chan[delay_samples:] = l_chan[:-delay_samples]

        fake_res = detect_fake_stereo(l_chan, r_chan, sr)
        assert fake_res["has_fake_stereo"] is True
        assert fake_res["is_haas_effect"] is True
        assert fake_res["haas_delay_ms"] > 0.0


# ============================================================================
# SECTION 2: BOUNDARY & CALIBRATION EDGE CASES
# ============================================================================
class TestDSPBoundaryAndCalibrationCases:
    """Menguji ambang batas (thresholds) matematis, inter-sample peaks, dan batasan skor 5 - 100."""

    def test_ED01_dc_offset_threshold_boundary(self):
        """ED-01: Ambang batas deteksi DC offset (0.005 / ~ -46 dBFS)."""
        sr = 48000
        t = np.linspace(0, 1.0, sr, endpoint=False)
        base_sine = 0.5 * np.sin(2 * np.pi * 400 * t)

        # Di bawah threshold: 0.003
        sig_below = base_sine + 0.003
        res_below = detect_dc_offset(sig_below, threshold=0.005)
        assert res_below["has_dc_offset"] is False

        # Tepat di atas threshold: 0.007
        sig_above = base_sine + 0.007
        res_above = detect_dc_offset(sig_above, threshold=0.005)
        assert res_above["has_dc_offset"] is True

    def test_ED02_true_peak_inter_sample_peaks_4x_oversampling(self):
        """ED-02: True-Peak 4x oversampling harus menangkap Inter-Sample Peaks (ISP) yang melampaui puncak diskrit."""
        sr = 48000
        # Frekuensi fs/4 (12 kHz) dengan fase 45 derajat menghasilkan sampel diskrit di ~0.707,
        # tetapi gelombang kontinu analog mencapai puncak 1.0 (perbedaan > 3 dB).
        t = np.arange(4800) / sr
        freq = sr / 4.0
        # Phase shift 45 derajat (pi/4)
        phase_shifted = np.sin(2 * np.pi * freq * t + (np.pi / 4.0))

        discrete_peak = np.max(np.abs(phase_shifted))
        tp_dbfs, linear_tp = compute_true_peak(phase_shifted, sr, oversample=4)

        # Puncak oversampled harus lebih besar daripada puncak sampel diskrit
        assert linear_tp > discrete_peak
        assert np.isclose(linear_tp, 1.0, atol=0.05)
        assert tp_dbfs > 20.0 * np.log10(discrete_peak)

    def test_ED03_comb_filtering_micro_delay_window(self):
        """ED-03: Jendela deteksi comb filtering harus aktif hanya pada delay 0.15ms s.d. 15.0ms."""
        sr = 48000
        t = np.linspace(0, 1.0, sr, endpoint=False)
        base = (np.sin(2 * np.pi * 200 * t) + 0.3 * np.sin(2 * np.pi * 600 * t)) * np.exp(-t * 10)

        # Kasus A: Delay terlalu kecil (0.05 ms = 2.4 sampel di 48kHz) -> di bawah 0.15 ms
        lag_tiny = int(sr * 0.00005)
        sig_tiny = np.zeros_like(base)
        sig_tiny[lag_tiny:] = base[:-lag_tiny]
        res_tiny = analyze_track_pair_phase(base, sig_tiny, sr)
        assert res_tiny["has_comb_filtering"] is False, "Delay < 0.15ms tidak boleh ditandai comb filtering"

        # Kasus B: Delay pas di jendela comb filtering (2.5 ms = 120 sampel)
        lag_mid = int(sr * 0.0025)
        sig_mid = np.zeros_like(base)
        sig_mid[lag_mid:] = base[:-lag_mid]
        res_mid = analyze_track_pair_phase(base, sig_mid, sr)
        assert res_mid["has_comb_filtering"] is True
        assert np.isclose(res_mid["delay_ms"], 2.5, atol=0.2) or np.isclose(res_mid["delay_ms"], -2.5, atol=0.2)

        # Kasus C: Delay terlalu besar (> 20 ms)
        lag_huge = int(sr * 0.025)
        sig_huge = np.zeros_like(base)
        sig_huge[lag_huge:] = base[:-lag_huge]
        res_huge = analyze_track_pair_phase(base, sig_huge, sr)
        assert res_huge["has_comb_filtering"] is False, "Delay > 15ms diperlakukan sebagai echo musikal terpisah"

    def test_ED04_health_score_clamping_floor_and_ceiling(self):
        """ED-04: Skor kesehatan sesi harus dibatasi secara aman dalam rentang [5.0, 100.0]."""
        # 1. Perfect Session: Tidak boleh melebihi 100.0
        perfect_tracks = [
            {"health_status": "Clean", "penalty": 0.0},
            {"health_status": "Clean", "penalty": 0.0}
        ]
        score_perfect = calculate_session_health(perfect_tracks, [])
        assert score_perfect["health_score"] == 100.0

        # 2. Catastrophically Broken Session: Banyak track Critical dengan penalti maksimal
        terrible_tracks = [
            {"health_status": "Critical", "penalty": 80.0} for _ in range(12)
        ]
        score_terrible = calculate_session_health(terrible_tracks, [])
        assert score_terrible["health_score"] >= 5.0, "Health score tidak boleh bernilai negatif / di bawah 5.0"
        assert score_terrible["session_rating"] == "CRITICAL"


# ============================================================================
# SECTION 3: HAPPY PATH FUNCTIONAL VERIFICATION (LAST)
# ============================================================================
class TestDSPHappyPathVerification:
    """Menguji eksekusi normal analisis audio berkualitas tinggi, saran perbaikan, dan skor sesi."""

    @pytest.fixture(autouse=True)
    def setup_audio_signal(self):
        self.sr = 48000
        self.t = np.linspace(0, 1.0, self.sr, endpoint=False)

    def test_HP01_pristine_clean_vocal_track_health(self):
        """HP-01: Trek vokal bersih tanpa distorsi, tanpa DC offset, dan dinamika sehat (score = 100)."""
        clean_vocal = 0.5 * np.sin(2 * np.pi * 440 * self.t) * (0.3 + 0.7 * np.exp(-self.t * 2))  # -6 dBFS clean
        metrics = analyze_track_signals(clean_vocal, self.sr, instrument_label="Vocals: Lead")

        assert metrics["is_clipping"] is False
        assert metrics["has_dc_offset"] is False
        assert metrics["has_sub_rumble"] is False
        assert -7.0 <= metrics["peak_dbfs"] <= -5.0
        assert metrics["crest_factor_db"] >= 6.0

        track_health = calculate_track_health(metrics)
        assert track_health["health_status"] == "Clean"
        assert track_health["track_score"] == 100.0
        assert track_health["penalty"] == 0.0
        assert len(track_health["recommendations"]) == 0

    def test_HP02_actionable_recommendations_inverted_snare(self):
        """HP-02: Memberikan rekomendasi teknis Bahasa Indonesia yang tepat saat mendeteksi Snare Top/Btm terbalik."""
        pair_info = {
            "has_polarity_invert": True,
            "pairedTrackName": "Snare Top",
            "correlation": -0.98,
            "delay_ms": 0.0
        }
        metrics = {"fileName": "Snare Bottom.wav", "true_peak_dbfs": -3.0, "is_clipping": False}

        track_health = calculate_track_health(metrics, pair_info)
        assert track_health["health_status"] == "Critical"
        assert track_health["has_polarity_invert"] is True
        assert track_health["track_score"] <= 75.0  # Dipotong bobot 25.0

        # Verifikasi konten rekomendasi teknis
        recs = track_health["recommendations"]
        assert len(recs) >= 1
        polarity_rec = next((r for r in recs if r["type"] == "POLARITY_INVERT"), None)
        assert polarity_rec is not None
        assert polarity_rec["severity"] == "CRITICAL"
        assert "Snare Top" in polarity_rec["message"]
        assert "Phase Flip" in polarity_rec["message"]

    def test_HP03_actionable_recommendations_clipping_gain_cut(self):
        """HP-03: Memberikan rekomendasi dB pemotongan gain spesifik saat terjadi True-Peak clipping."""
        metrics = {
            "fileName": "Guitar Solo.wav",
            "is_clipping": True,
            "true_peak_dbfs": 1.4,
            "crest_factor_db": 10.0
        }

        track_health = calculate_track_health(metrics)
        assert track_health["health_status"] == "Critical"

        recs = track_health["recommendations"]
        clip_rec = next((r for r in recs if r["type"] == "CLIPPING"), None)
        assert clip_rec is not None
        assert clip_rec["severity"] == "CRITICAL"
        assert "1.4 dBFS" in clip_rec["message"]
        assert "Turunkan clip gain" in clip_rec["message"]

    def test_HP04_multitrack_session_health_score_evaluation(self):
        """HP-04: Kalkulasi skor sesi komprehensif pada perpaduan track bersih, warning, dan kritis (UC-13)."""
        tracks = [
            # 3 track bersih
            {"health_status": "Clean", "penalty": 0.0},
            {"health_status": "Clean", "penalty": 0.0},
            {"health_status": "Clean", "penalty": 0.0},
            # 1 track warning (DC offset)
            {"health_status": "Warning", "penalty": PENALTY_WEIGHTS["dc_offset"]},
            # 1 track critical (Polarity Invert)
            {"health_status": "Critical", "penalty": PENALTY_WEIGHTS["polarity_invert"]},
        ]

        session_res = calculate_session_health(tracks, [])
        assert session_res["total_tracks"] == 5
        assert session_res["clean_tracks"] == 3
        assert session_res["warning_tracks"] == 1
        assert session_res["critical_tracks"] == 1
        assert 60.0 <= session_res["health_score"] <= 85.0
        assert session_res["session_rating"] in ["WARNING", "CRITICAL"]
        assert session_res["estimated_tokens"] == 1  # <= 3 problematic tracks
