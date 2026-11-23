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
    decode_audio_bytes,
    detect_active_regions,
    split_audio_by_regions,
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


def test_detect_active_regions_bridges_short_gaps_and_clamps_overlap_padding():
    sr = 48000
    # Burst 1 (0.5s) + 80ms short gap (< 300ms) + Burst 2 (0.5s) + 600ms long gap + Burst 3 (0.5s)
    audio = np.vstack([
        np.zeros((int(0.2 * sr), 2), dtype=np.float32),
        _make_sine(440.0, 0.5, sr=sr, amp=0.5),
        np.zeros((int(0.08 * sr), 2), dtype=np.float32),
        _make_sine(440.0, 0.5, sr=sr, amp=0.5),
        np.zeros((int(0.60 * sr), 2), dtype=np.float32),
        _make_sine(440.0, 0.5, sr=sr, amp=0.5),
        np.zeros((int(0.2 * sr), 2), dtype=np.float32),
    ])

    regions = detect_active_regions(
        audio,
        sr,
        threshold_db=-45.0,
        min_silence_gap_ms=300.0,
        min_asset_ms=100.0,
        pad_ms=50.0,
    )
    assert len(regions) == 2
    assert 1.05 <= regions[0]["duration_sec"] <= 1.25
    assert 0.55 <= regions[1]["duration_sec"] <= 0.65
    assert regions[0]["end_sec"] <= regions[1]["start_sec"]

    # Narrow 40ms gap (< 2 * pad_ms=50ms) with min_silence_gap_ms=20ms keeps 2 regions and clamps at midpoint
    narrow_audio = np.vstack([
        np.zeros((int(0.2 * sr), 2), dtype=np.float32),
        _make_sine(440.0, 0.4, sr=sr, amp=0.5),
        np.zeros((int(0.04 * sr), 2), dtype=np.float32),
        _make_sine(440.0, 0.4, sr=sr, amp=0.5),
        np.zeros((int(0.2 * sr), 2), dtype=np.float32),
    ])
    narrow_regions = detect_active_regions(
        narrow_audio,
        sr,
        threshold_db=-45.0,
        min_silence_gap_ms=20.0,
        min_asset_ms=100.0,
        pad_ms=50.0,
    )
    assert len(narrow_regions) == 2
    assert narrow_regions[0]["end_sec"] <= narrow_regions[1]["start_sec"]
    assert abs(narrow_regions[0]["end_sec"] - 0.62) < 0.015
    assert abs(narrow_regions[1]["start_sec"] - 0.62) < 0.015


def test_detect_active_regions_filters_short_noise_and_rejects_full_silence():
    sr = 48000
    # 20ms noise spike + 500ms silence + 300ms valid burst -> only valid burst kept
    audio_with_spike = np.vstack([
        np.zeros((int(0.1 * sr), 2), dtype=np.float32),
        _make_sine(880.0, 0.02, sr=sr, amp=0.6),
        np.zeros((int(0.5 * sr), 2), dtype=np.float32),
        _make_sine(440.0, 0.3, sr=sr, amp=0.5),
        np.zeros((int(0.1 * sr), 2), dtype=np.float32),
    ])
    regions = detect_active_regions(
        audio_with_spike,
        sr,
        threshold_db=-45.0,
        min_silence_gap_ms=200.0,
        min_asset_ms=100.0,
        pad_ms=20.0,
    )
    assert len(regions) == 1
    assert regions[0]["start_sec"] >= 0.55

    # Only 20ms spike when min_asset_ms=100 -> rejected
    only_spike = np.vstack([
        np.zeros((int(0.2 * sr), 2), dtype=np.float32),
        _make_sine(880.0, 0.02, sr=sr, amp=0.6),
        np.zeros((int(0.2 * sr), 2), dtype=np.float32),
    ])
    with pytest.raises(ValueError, match="hening"):
        detect_active_regions(only_spike, sr, threshold_db=-45.0, min_asset_ms=100.0)

    # Pure silence -> rejected
    silent = np.zeros((2 * sr, 2), dtype=np.float32)
    with pytest.raises(ValueError, match="hening"):
        detect_active_regions(silent, sr, threshold_db=-45.0)


def test_split_audio_by_regions_slices_pcm24_with_zero_crossing_fade_and_dedup_names():
    sr = 48000
    audio = _make_sine(220.0, 2.0, sr=sr, amp=0.8)

    assets = split_audio_by_regions(
        audio,
        sr,
        regions=[
            {"name": "../sfx", "start_sec": 0.2, "end_sec": 0.9},
            {"name": "sfx", "start_sec": 1.2, "end_sec": 1.8},
            {"name": "../..", "start_sec": 1.85, "end_sec": 1.98},
        ],
        fade_ms=15.0,
    )
    assert len(assets) == 3
    assert assets[0]["name"] == "sfx"
    assert assets[0]["file_name"] == "sfx.wav"
    assert assets[1]["name"] == "sfx_1"
    assert assets[1]["file_name"] == "sfx_1.wav"
    assert assets[2]["name"] == "asset_3"
    assert assets[2]["file_name"] == "asset_3.wav"

    for asset in assets[:2]:
        info = sf.info(io.BytesIO(asset["wav_bytes"]))
        assert info.samplerate == 48000
        assert info.subtype == "PCM_24"
        assert info.channels == 2
        sliced, _ = sf.read(io.BytesIO(asset["wav_bytes"]), dtype="float32")
        assert abs(float(sliced[0, 0])) < 1e-4
        assert abs(float(sliced[-1, 0])) < 1e-4

    # Reject empty, >100, inverted, too short (<0.01s), and non-finite bounds
    with pytest.raises(ValueError):
        split_audio_by_regions(audio, sr, regions=[])
    with pytest.raises(ValueError):
        split_audio_by_regions(
            audio,
            sr,
            regions=[{"name": f"r{i}", "start_sec": 0.0, "end_sec": 0.1} for i in range(101)],
        )
    with pytest.raises(ValueError):
        split_audio_by_regions(audio, sr, regions=[{"name": "bad", "start_sec": 1.5, "end_sec": 1.0}])
    with pytest.raises(ValueError):
        split_audio_by_regions(audio, sr, regions=[{"name": "tiny", "start_sec": 0.5, "end_sec": 0.505}])
    with pytest.raises(ValueError):
        split_audio_by_regions(audio, sr, regions=[{"name": "nan", "start_sec": float("nan"), "end_sec": 0.5}])


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


def test_worker_split_workbench_audio_uploads_assets_to_s3():
    import worker as worker_mod

    sr = 48000
    kit_audio = np.vstack([
        np.zeros((int(0.2 * sr), 2), dtype=np.float32),
        _make_sine(120.0, 0.5, sr, amp=0.5),
        np.zeros((int(0.5 * sr), 2), dtype=np.float32),
        _make_sine(440.0, 0.6, sr, amp=0.5),
        np.zeros((int(0.2 * sr), 2), dtype=np.float32),
    ])

    s3_objects = {
        "workbench/u1/raw/kit.wav": _to_wav_bytes(kit_audio, sr),
    }
    get_calls = []

    class FakeS3:
        def get_object(self, Bucket, Key):
            get_calls.append(Key)
            return {"Body": io.BytesIO(s3_objects[Key])}

        def put_object(self, Bucket, Key, Body, ContentType=None):
            s3_objects[Key] = Body

    with patch.object(worker_mod, "get_s3_client", return_value=FakeS3()):
        res = worker_mod.split_workbench_audio({
            "splitId": "split-abc",
            "userId": "u1",
            "sourceStorageKey": "workbench/u1/raw/kit.wav",
            "fileName": "kit.wav",
            "regions": [
                {"name": "kick", "startSec": 0.18, "endSec": 0.72},
                {"name": "snare", "startSec": 1.18, "endSec": 1.82},
            ],
            "fadeMs": 15.0,
        })

    assert get_calls == ["workbench/u1/raw/kit.wav"]
    assert res["splitId"] == "split-abc"
    assert abs(res["durationSec"] - 2.0) < 0.01
    assert len(res["assets"]) == 2
    assert res["assets"][0]["name"] == "kick"
    assert res["assets"][0]["fileName"] == "kick.wav"
    assert res["assets"][1]["name"] == "snare"
    assert res["assets"][1]["fileName"] == "snare.wav"
    for asset in res["assets"]:
        key = asset["storageKey"]
        assert key.startswith("workbench/u1/split-split-abc/")
        assert key.endswith(f"_{asset['fileName']}")
        assert key in s3_objects
        info = sf.info(io.BytesIO(s3_objects[key]))
        assert info.samplerate == 48000
        assert info.subtype == "PCM_24"
        assert abs(asset["durationSec"] - info.duration) < 0.01


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


def test_encode_wav_bytes_defaults_to_pcm24_and_transcodes_formats():
    from workbench.silence_trimmer import encode_wav_bytes
    from workbench.audio_exporter import transcode_audio_bytes

    sr = 48000
    sine = _make_sine(440.0, 0.5, sr=sr, amp=0.5)
    wav24_bytes = encode_wav_bytes(sine, sr)
    info = sf.info(io.BytesIO(wav24_bytes))
    assert info.subtype == "PCM_24"
    assert info.samplerate == 48000

    flac_out = transcode_audio_bytes(wav24_bytes, target_format="flac24")
    assert flac_out["ext"] == ".flac"
    assert flac_out["mime"] == "audio/flac"
    flac_info = sf.info(io.BytesIO(flac_out["bytes"]))
    assert flac_info.format == "FLAC"
    assert flac_info.subtype == "PCM_24"
    assert len(flac_out["bytes"]) < len(wav24_bytes)

    mp3_out = transcode_audio_bytes(wav24_bytes, target_format="mp3_320")
    assert mp3_out["ext"] == ".mp3"
    assert mp3_out["mime"] == "audio/mpeg"
    assert len(mp3_out["bytes"]) > 0
    assert len(mp3_out["bytes"]) < len(wav24_bytes)

    with pytest.raises(ValueError, match="tidak didukung"):
        transcode_audio_bytes(wav24_bytes, target_format="ogg_invalid")
