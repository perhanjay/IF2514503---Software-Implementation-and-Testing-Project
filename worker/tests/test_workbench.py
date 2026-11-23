import io
import json
import os
import sys
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
import soundfile as sf

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from workbench.silence_trimmer import (
    compute_union_trim_bounds,
    decode_audio_bytes,
    slice_aligned_batch,
    trim_audio_silence,
)
from workbench.stem_separator import STEM_ORDER, separate_audio_stems


def _make_sine(freq: float, duration_sec: float, sr: int = 48000, amp: float = 0.5) -> np.ndarray:
    t = np.linspace(0, duration_sec, int(sr * duration_sec), endpoint=False, dtype=np.float32)
    wave = amp * np.sin(2.0 * np.pi * freq * t)
    return np.column_stack([wave, wave]).astype(np.float32)


def _to_wav_bytes(audio: np.ndarray, sr: int = 48000) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV", subtype="FLOAT")
    return buf.getvalue()


def test_silence_trimmer_strips_lead_and_tail():
    sr = 48000
    audio = np.vstack([
        np.zeros((3 * sr, 2), dtype=np.float32),
        _make_sine(440.0, 2.0, sr=sr, amp=0.5),
        np.zeros((4 * sr, 2), dtype=np.float32),
    ])
    res = trim_audio_silence(audio, sr, threshold_db=-45.0, pad_ms=100.0, fade_ms=15.0)
    assert 2.15 <= res["trimmed_duration_sec"] <= 2.30
    assert 2.85 <= res["lead_in_removed_sec"] <= 3.05
    assert 3.85 <= res["tail_removed_sec"] <= 4.05
    assert len(res["peaks"]) == 200


def test_silence_trimmer_applies_zero_crossing_fade():
    sr = 48000
    audio = _make_sine(220.0, 1.0, sr=sr, amp=0.8)
    # Force DC discontinuity at both edges using manual trim without silence pad
    res = trim_audio_silence(audio, sr, fade_ms=15.0, manual_start_sec=0.1, manual_end_sec=0.9)
    trimmed = res["trimmed_audio"]
    assert abs(float(trimmed[0, 0])) < 1e-4
    assert abs(float(trimmed[-1, 0])) < 1e-4


def test_silence_trimmer_rejects_full_silence_and_invalid_bounds():
    sr = 48000
    silent = np.zeros((2 * sr, 2), dtype=np.float32)
    with pytest.raises(ValueError, match="hening"):
        trim_audio_silence(silent, sr, threshold_db=-45.0)

    active = _make_sine(440.0, 2.0, sr=sr)
    with pytest.raises(ValueError, match="batas"):
        trim_audio_silence(active, sr, manual_start_sec=1.5, manual_end_sec=1.0)


def test_union_envelope_preserves_intro_drum_when_vocal_enters_late():
    sr = 48000
    # 2s total silence -> 2s drum intro (vocal still silent) -> 2s both active -> 2s end silence
    drums = np.vstack([
        np.zeros((2 * sr, 2), dtype=np.float32),
        _make_sine(100.0, 4.0, sr=sr, amp=0.6),
        np.zeros((2 * sr, 2), dtype=np.float32),
    ])
    vocals = np.vstack([
        np.zeros((4 * sr, 2), dtype=np.float32),
        _make_sine(800.0, 2.0, sr=sr, amp=0.6),
        np.zeros((2 * sr, 2), dtype=np.float32),
    ])
    stems = {"drums": drums, "vocals": vocals, "bass": drums.copy(), "other": vocals.copy()}
    start_idx, end_idx = compute_union_trim_bounds(stems, sr, threshold_db=-45.0, pad_ms=100.0)
    # Cut must happen around t=1.9s (keeping the 2s..4s drum intro intact)
    assert start_idx / sr <= 2.0
    assert end_idx / sr >= 6.0

    batch = slice_aligned_batch(stems, sr, start_idx, end_idx, fade_ms=15.0)
    lengths = {len(v["trimmed_audio"]) for v in batch.values()}
    assert len(lengths) == 1


def test_corrupt_audio_bytes_rejected_cleanly():
    with pytest.raises(ValueError, match="rusak|tidak didukung"):
        decode_audio_bytes(b"not-valid-audio-data", "corrupt.wav")


def test_stem_separator_produces_four_zero_aligned_stems_fast_mode():
    sr = 48000
    mix = _make_sine(80.0, 1.5, sr, amp=0.4) + _make_sine(1000.0, 1.5, sr, amp=0.4)
    wav_bytes = _to_wav_bytes(mix, sr)

    result = separate_audio_stems(wav_bytes, "test_mix.wav", use_fast_fallback=True)
    assert result["sample_rate"] == 48000
    assert set(result["stems"].keys()) == set(STEM_ORDER)
    durations = []
    for name, stem_bytes in result["stems"].items():
        data, stem_sr = sf.read(io.BytesIO(stem_bytes), dtype="float32")
        assert stem_sr == 48000
        assert data.ndim == 2 and data.shape[1] == 2
        durations.append(len(data))
    assert len(set(durations)) == 1


def test_decode_audio_bytes_resamples_mono_44100_to_stereo_48000():
    sr_in = 44100
    t = np.linspace(0, 0.5, int(sr_in * 0.5), endpoint=False, dtype=np.float32)
    mono = 0.5 * np.sin(2.0 * np.pi * 440.0 * t)
    buf = io.BytesIO()
    sf.write(buf, mono, sr_in, format="WAV", subtype="FLOAT")

    decoded, sr_out = decode_audio_bytes(buf.getvalue(), "mono_44k.wav")
    assert sr_out == 48000
    assert decoded.ndim == 2 and decoded.shape[1] == 2
    assert decoded.dtype == np.float32
    assert abs(decoded.shape[0] - 24000) <= 2


def test_worker_separate_workbench_audio_s3_and_redis(monkeypatch):
    import worker as worker_mod

    sr = 48000
    mix = _make_sine(200.0, 1.0, sr, amp=0.5)
    source_bytes = _to_wav_bytes(mix, sr)

    uploaded = {}

    class FakeS3:
        def get_object(self, Bucket, Key):
            return {"Body": io.BytesIO(source_bytes)}

        def put_object(self, Bucket, Key, Body, ContentType=None):
            uploaded[Key] = Body

    fake_redis_store = {
        "workbench:job:job-1": json.dumps({
            "jobId": "job-1",
            "status": "PROCESSING",
            "progress": 5,
            "stepMessage": "Queued",
        })
    }
    progress_history = []

    class FakeRedis:
        def get(self, key):
            return fake_redis_store.get(key)

        def set(self, key, value, ex=None):
            fake_redis_store[key] = value
            progress_history.append(json.loads(value)["stepMessage"])

    monkeypatch.setenv("POLARIS_FAST_STEM_MODE", "1")
    with patch.object(worker_mod, "get_s3_client", return_value=FakeS3()), \
         patch.object(worker_mod.redis, "Redis", return_value=FakeRedis()):
        res = worker_mod.separate_workbench_audio({
            "jobId": "job-1",
            "userId": "user-1",
            "fileName": "song.wav",
            "sourceStorageKey": "workbench/user-1/job-1/raw/song.wav",
            "redisKey": "workbench:job:job-1",
        })

    assert res["status"] == "COMPLETED"
    assert abs(res["durationSec"] - 1.0) < 0.01
    assert len(res["stems"]) == 4
    assert [s["name"] for s in res["stems"]] == list(STEM_ORDER)
    for s in res["stems"]:
        assert s["storageKey"] in uploaded
    assert "Separating Stems" in progress_history
    assert "Uploading to S3" in progress_history


def test_worker_trim_workbench_audio_single_and_synced(monkeypatch):
    import worker as worker_mod

    sr = 48000
    drums = np.vstack([
        np.zeros((sr, 2), dtype=np.float32),
        _make_sine(100.0, 2.0, sr, amp=0.5),
        np.zeros((sr, 2), dtype=np.float32),
    ])
    vocals = np.vstack([
        np.zeros((2 * sr, 2), dtype=np.float32),
        _make_sine(600.0, 1.0, sr, amp=0.5),
        np.zeros((sr, 2), dtype=np.float32),
    ])

    s3_objects = {
        "workbench/u1/j1/stems/drums.wav": _to_wav_bytes(drums, sr),
        "workbench/u1/j1/stems/vocals.wav": _to_wav_bytes(vocals, sr),
        "workbench/u1/j1/stems/bass.wav": _to_wav_bytes(drums, sr),
        "workbench/u1/j1/stems/other.wav": _to_wav_bytes(vocals, sr),
    }

    class FakeS3:
        def get_object(self, Bucket, Key):
            return {"Body": io.BytesIO(s3_objects[Key])}

        def put_object(self, Bucket, Key, Body, ContentType=None):
            s3_objects[Key] = Body

    with patch.object(worker_mod, "get_s3_client", return_value=FakeS3()):
        single_res = worker_mod.trim_workbench_audio({
            "mode": "single",
            "sourceStorageKey": "workbench/u1/j1/stems/vocals.wav",
            "targetKey": "workbench/u1/trim-1/FIXED_vocals.wav",
            "thresholdDb": -45.0,
            "padMs": 100.0,
            "fadeMs": 15.0,
        })
        assert single_res["targetKey"] == "workbench/u1/trim-1/FIXED_vocals.wav"
        assert single_res["trimmedDurationSec"] < single_res["originalDurationSec"]
        assert 1.1 <= single_res["trimmedDurationSec"] <= 1.3
        assert len(single_res["trimmedPeaks"]) == 200
        assert "workbench/u1/trim-1/FIXED_vocals.wav" in s3_objects

        synced_res = worker_mod.trim_workbench_audio({
            "mode": "synced",
            "stems": [
                {"name": "vocals", "sourceStorageKey": "workbench/u1/j1/stems/vocals.wav", "targetKey": "workbench/u1/j1/trimmed/vocals.wav"},
                {"name": "drums", "sourceStorageKey": "workbench/u1/j1/stems/drums.wav", "targetKey": "workbench/u1/j1/trimmed/drums.wav"},
                {"name": "bass", "sourceStorageKey": "workbench/u1/j1/stems/bass.wav", "targetKey": "workbench/u1/j1/trimmed/bass.wav"},
                {"name": "other", "sourceStorageKey": "workbench/u1/j1/stems/other.wav", "targetKey": "workbench/u1/j1/trimmed/other.wav"},
            ],
            "thresholdDb": -45.0,
            "padMs": 100.0,
            "fadeMs": 15.0,
        })
        assert len(synced_res["updatedStems"]) == 4
        durations = {s["durationSec"] for s in synced_res["updatedStems"]}
        assert len(durations) == 1
        assert 2.1 <= synced_res["trimmedDurationSec"] <= 2.3

        default_target_res = worker_mod.trim_workbench_audio({
            "mode": "single",
            "sourceStorageKey": "workbench/u1/j1/stems/vocals.wav",
            "thresholdDb": -45.0,
            "padMs": 100.0,
            "fadeMs": 15.0,
        })
        assert default_target_res["targetKey"].startswith("workbench/u1/j1/stems/TRIMMED_")
        assert default_target_res["targetKey"] in s3_objects


def test_decode_audio_bytes_ffmpeg_mp3_fallback():
    import shutil
    import subprocess
    if shutil.which("ffmpeg") is None:
        pytest.skip("ffmpeg not installed")

    sr = 44100
    sine = _make_sine(440.0, 0.5, sr=sr, amp=0.4)
    wav_bytes = _to_wav_bytes(sine, sr)
    proc = subprocess.run(
        ["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-f", "wav", "-i", "pipe:0", "-f", "mp3", "pipe:1"],
        input=wav_bytes,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    decoded, out_sr = decode_audio_bytes(proc.stdout, "sample.mp3")
    assert out_sr == 48000
    assert decoded.ndim == 2 and decoded.shape[1] == 2
    assert decoded.dtype == np.float32
    assert decoded.shape[0] > 20000


def test_decode_with_ffmpeg_timeout_raises_value_error_and_cleans_temp_files():
    import subprocess
    import tempfile
    from workbench import silence_trimmer as st_mod

    created_paths = []
    real_ntf = tempfile.NamedTemporaryFile

    def tracking_ntf(*args, **kwargs):
        tmp = real_ntf(*args, **kwargs)
        created_paths.append(tmp.name)
        return tmp

    def fake_run(cmd, **kwargs):
        assert kwargs.get("timeout") == 60
        raise subprocess.TimeoutExpired(cmd=cmd, timeout=60)

    with patch.object(st_mod.tempfile, "NamedTemporaryFile", side_effect=tracking_ntf), \
         patch.object(st_mod.subprocess, "run", side_effect=fake_run):
        with pytest.raises(ValueError, match="rusak|tidak didukung"):
            st_mod._decode_with_ffmpeg(b"corrupt-mp3-bytes", "hung.mp3")

    assert len(created_paths) == 2
    for path in created_paths:
        assert not os.path.exists(path)
