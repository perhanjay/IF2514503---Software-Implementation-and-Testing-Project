"""
Phase 5: DSP Audio Repair Engine Test Suite (UC-14 & UC-15)
============================================================
Prinsip Pengujian: "Happy Path Last"
  1. Negative, Empty & Extreme Corruption Cases
  2. Granular DSP Transformations (FR-5.1 s/d FR-5.7)
  3. Orchestrated Auto & Custom Repair Verification
"""

import sys
import os
import numpy as np
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from dsp.repair_engine import (
    flip_polarity,
    eliminate_dc_offset,
    collapse_to_true_mono,
    filter_sub_rumble,
    align_pair_microdelay,
    apply_gain_staging,
    execute_track_repairs
)
from dsp.phase_analyzer import compute_stereo_correlation

class TestDSPRepairNegativeAndEdgeCases:
    """Menguji penanganan input ekstrim, array kosong, dan sinyal hening."""

    def test_empty_audio_handling(self):
        empty = np.array([], dtype=np.float32)
        assert len(flip_polarity(empty)) == 0
        assert len(eliminate_dc_offset(empty)) == 0
        assert len(collapse_to_true_mono(empty)) == 0
        assert len(apply_gain_staging(empty)) == 0

        shifted, lag, delay = align_pair_microdelay(empty, empty, 44100)
        assert len(shifted) == 0
        assert lag == 0
        assert delay == 0.0

    def test_pure_silence_handling(self):
        silence = np.zeros(1000, dtype=np.float32)
        staged = apply_gain_staging(silence, target_peak_dbfs=-3.0)
        assert np.max(np.abs(staged)) == 0.0

class TestDSPRepairTransformations:
    """Menguji fungsi-fungsi spesifik transformasi perbaikan DSP."""

    def test_FR51_polarity_flip_null_test(self):
        """FR-5.1: Pembalikan polaritas harus menghasilkan pembatalan sempurna (Null Test) saat dijumlahkan."""
        sr = 44100
        t = np.linspace(0, 1.0, sr, endpoint=False)
        original = (0.5 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
        
        flipped = flip_polarity(original)
        
        # Null test: original + flipped == 0.0
        summed = original + flipped
        assert np.max(np.abs(summed)) < 1e-6
        # Korelasi antara original dan flipped harus tepat -1.0
        corr = compute_stereo_correlation(original, flipped)
        assert np.isclose(corr, -1.0, atol=1e-3)

    def test_FR55_dc_offset_elimination(self):
        """FR-5.5: Eliminasi DC offset harus memusatkan sinyal kembali tepat di sumbu 0.0."""
        sr = 44100
        t = np.linspace(0, 1.0, sr, endpoint=False)
        sine = 0.4 * np.sin(2 * np.pi * 100 * t)
        dc_biased = (sine + 0.25).astype(np.float32)

        assert abs(np.mean(dc_biased)) > 0.2

        cleaned = eliminate_dc_offset(dc_biased, sr)
        assert abs(np.mean(cleaned)) < 1e-6
        # Nilai peak sinyal yang telah dibersihkan harus berkurang karena offset hilang
        assert np.max(np.abs(cleaned)) < np.max(np.abs(dc_biased))

    def test_FR53_fake_stereo_collapse_to_true_mono(self):
        """FR-5.3: Fake stereo dengan Haas delay harus diubah menjadi true mono yang identik di L dan R."""
        sr = 44100
        t = np.linspace(0, 1.0, sr, endpoint=False)
        base = 0.5 * np.sin(2 * np.pi * 300 * t)
        # Haas delay pada kanal kanan (10 ms delay)
        delay_samples = int(sr * 0.010)
        right = np.zeros_like(base)
        right[delay_samples:] = base[:-delay_samples]
        stereo = np.column_stack([base, right]).astype(np.float32)

        collapsed = collapse_to_true_mono(stereo)
        assert collapsed.shape == stereo.shape
        # Kanal L dan R harus identik sempurna (korelasi 1.0)
        corr = compute_stereo_correlation(collapsed[:, 0], collapsed[:, 1])
        assert np.isclose(corr, 1.0, atol=1e-4)

    def test_FR52_microdelay_alignment(self):
        """FR-5.2: Pasangan mikrofon dengan selisih waktu harus diselaraskan secara akurat."""
        sr = 44100
        t = np.linspace(0, 1.0, sr, endpoint=False)
        sig_a = (0.6 * np.sin(2 * np.pi * 200 * t)).astype(np.float32)
        
        # Track B tertunda 5 ms (220 sampel)
        delay_samples = 220
        sig_b = np.zeros_like(sig_a)
        sig_b[delay_samples:] = sig_a[:-delay_samples]

        aligned_b, lag, delay_ms = align_pair_microdelay(sig_a, sig_b, sr, max_delay_ms=25.0)
        
        assert lag == delay_samples
        assert np.isclose(delay_ms, (delay_samples / sr) * 1000.0, atol=0.1)
        # Korelasi sinyal A dan B yang telah diselaraskan harus mendekati 1.0
        corr_before = compute_stereo_correlation(sig_a, sig_b)
        corr_after = compute_stereo_correlation(sig_a, aligned_b)
        assert corr_after > corr_before
        assert corr_after > 0.95

    def test_FR56_sub_rumble_highpass_filter(self):
        """FR-5.6: Filter HPF 35 Hz harus meredam frekuensi sub-sonik (15 Hz) secara drastis."""
        sr = 44100
        t = np.linspace(0, 1.0, sr, endpoint=False)
        # Sinyal gabungan: 15 Hz (sub-rumble) + 1000 Hz (vokal)
        rumble = 0.5 * np.sin(2 * np.pi * 15 * t)
        vocal = 0.5 * np.sin(2 * np.pi * 1000 * t)
        audio = (rumble + vocal).astype(np.float32)

        filtered = filter_sub_rumble(audio, sr, cutoff_hz=35.0)

        # Energi keseluruhan harus berkurang karena komponen 15 Hz terpotong
        assert np.var(filtered) < np.var(audio)

    def test_FR57_gain_staging_headroom_target(self):
        """FR-5.7: Gain staging harus menormalkan peak ke -3.0 dBFS tanpa clipping."""
        sr = 44100
        t = np.linspace(0, 1.0, sr, endpoint=False)
        # Sinyal yang hampir clipping (0.999 peak)
        loud_signal = (0.999 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
        
        staged = apply_gain_staging(loud_signal, target_peak_dbfs=-3.0)
        peak_staged = float(np.max(np.abs(staged)))
        peak_staged_dbfs = 20.0 * np.log10(peak_staged)

        # Target peak -3.0 dBFS (sekitar 0.7079)
        assert np.isclose(peak_staged_dbfs, -3.0, atol=0.2)
        assert peak_staged < 0.72

class TestDSPRepairOrchestration:
    """Menguji eksekusi orkestrasi perbaikan otomatis dan kustom."""

    def test_execute_track_repairs_auto_vocal(self):
        sr = 44100
        t = np.linspace(0, 1.0, sr, endpoint=False)
        # Vokal dengan DC offset dan sub-rumble
        vocal = (0.4 * np.sin(2 * np.pi * 500 * t) + 0.3 * np.sin(2 * np.pi * 20 * t) + 0.15).astype(np.float32)

        options = {
            "flipPolarity": False,
            "alignDelay": False,
            "fixFakeStereo": False,
            "removeDcOffset": True,
            "filterSubRumble": True,
            "gainStaging": True
        }

        repaired, actions = execute_track_repairs(vocal, sr, instrument_label="Lead Vocal", options=options)
        
        assert "DC Offset Eliminated" in actions
        assert "Sub-Rumble High-Pass Filter (<35 Hz)" in actions
        assert "Headroom Staged to -3.0 dBFS Peak" in actions
        # Residual DC must be well below 0.1% (subsonic transient settling)
        assert abs(np.mean(repaired)) < 0.001

    def test_execute_track_repairs_protects_kick_from_sub_rumble_cut(self):
        """Instrumen Kick Drum dan Bass tidak boleh dipotong frekuensi sub-nya."""
        sr = 44100
        t = np.linspace(0, 1.0, sr, endpoint=False)
        kick = (0.8 * np.sin(2 * np.pi * 50 * t)).astype(np.float32)

        options = {
            "removeDcOffset": False,
            "filterSubRumble": True,
            "gainStaging": True
        }

        repaired, actions = execute_track_repairs(kick, sr, instrument_label="Drums: Kick", options=options)
        
        # Sub-rumble filter TIDAK boleh ada di actions untuk Kick
        assert "Sub-Rumble High-Pass Filter (<35 Hz)" not in actions
