import io
import math
import os
import re
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

TARGET_SAMPLE_RATE = 48000
_CORRUPT_AUDIO_MSG = "Berkas audio rusak atau format tidak didukung"
_INVALID_BOUNDS_MSG = "Rentang batas pemangkasan tidak valid"
_SILENT_AUDIO_MSG = "Audio sepenuhnya hening atau tidak ada segmen aktif yang memenuhi durasi minimal"
_INVALID_REGION_COUNT_MSG = "Jumlah region harus antara 1 hingga 100"
_MIN_REGION_DURATION_SEC = 0.01
_END_BOUND_TOLERANCE_SEC = 0.05


def _ensure_stereo_2d(audio_data: np.ndarray) -> np.ndarray:
    """Normalize 1D or multi-channel audio array to contiguous float32 stereo (N, 2)."""
    arr = np.asarray(audio_data, dtype=np.float32)
    if arr.ndim == 1:
        arr = np.column_stack([arr, arr])
    elif arr.ndim == 2:
        if arr.shape[1] == 1:
            arr = np.repeat(arr, 2, axis=1)
        elif arr.shape[1] > 2:
            arr = arr[:, :2]
    else:
        raise ValueError(_CORRUPT_AUDIO_MSG)
    return np.ascontiguousarray(arr, dtype=np.float32)


def _decode_with_ffmpeg(raw_bytes: bytes, file_name: str) -> tuple[np.ndarray, int]:
    """Decode compressed/unsupported containers via ffmpeg subprocess into float32 WAV."""
    ext = os.path.splitext(file_name or "")[1].lower()
    if not re.fullmatch(r"\.[a-z0-9]{1,8}", ext):
        ext = ".bin"

    in_path = None
    out_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as in_tmp:
            in_tmp.write(raw_bytes)
            in_path = in_tmp.name
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as out_tmp:
            out_path = out_tmp.name

        proc = subprocess.run(
            [
                "ffmpeg",
                "-nostdin",
                "-y",
                "-loglevel",
                "error",
                "-i",
                in_path,
                "-f",
                "wav",
                "-acodec",
                "pcm_f32le",
                "-ar",
                str(TARGET_SAMPLE_RATE),
                "-ac",
                "2",
                out_path,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
            timeout=60,
        )
        if proc.returncode != 0:
            raise ValueError(_CORRUPT_AUDIO_MSG)

        audio, sr = sf.read(out_path, dtype="float32", always_2d=True)
        return audio, int(sr)
    except subprocess.TimeoutExpired as exc:
        raise ValueError(_CORRUPT_AUDIO_MSG) from exc
    except FileNotFoundError as exc:
        raise ValueError(_CORRUPT_AUDIO_MSG) from exc
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(_CORRUPT_AUDIO_MSG) from exc
    finally:
        for path in (in_path, out_path):
            if path and os.path.exists(path):
                try:
                    os.unlink(path)
                except OSError:
                    pass


def decode_audio_bytes(raw_bytes: bytes, file_name: str) -> tuple[np.ndarray, int]:
    """Decode audio bytes into float32 stereo (N, 2) array at 48000 Hz."""
    if not raw_bytes:
        raise ValueError(_CORRUPT_AUDIO_MSG)

    try:
        audio, sr = sf.read(io.BytesIO(raw_bytes), dtype="float32", always_2d=True)
    except Exception:
        audio, sr = _decode_with_ffmpeg(raw_bytes, file_name)

    if audio.size == 0 or sr <= 0:
        raise ValueError(_CORRUPT_AUDIO_MSG)

    stereo = _ensure_stereo_2d(audio)
    if sr != TARGET_SAMPLE_RATE:
        divisor = math.gcd(TARGET_SAMPLE_RATE, int(sr))
        up = TARGET_SAMPLE_RATE // divisor
        down = int(sr) // divisor
        stereo = resample_poly(stereo, up, down, axis=0).astype(np.float32)

    stereo = np.nan_to_num(stereo, nan=0.0, posinf=1.0, neginf=-1.0)
    return np.ascontiguousarray(stereo, dtype=np.float32), TARGET_SAMPLE_RATE


def encode_wav_bytes(
    audio_data: np.ndarray,
    sample_rate: int = TARGET_SAMPLE_RATE,
    subtype: str = "PCM_24",
) -> bytes:
    """Encode stereo audio array into lossless WAV bytes (24-bit PCM by default)."""
    stereo = _ensure_stereo_2d(audio_data)
    if subtype != "FLOAT":
        stereo = np.clip(stereo, -1.0, 1.0)
    buf = io.BytesIO()
    sf.write(buf, stereo, int(sample_rate), format="WAV", subtype=subtype)
    return buf.getvalue()


def extract_waveform_peaks(audio_data: np.ndarray, num_bins: int = 200) -> list[float]:
    """Extract normalized peak envelope bins across audio duration for canvas preview."""
    if num_bins <= 0:
        return []
    arr = np.asarray(audio_data, dtype=np.float32)
    if arr.size == 0:
        return [0.0] * num_bins

    mono_env = np.max(np.abs(arr), axis=1) if arr.ndim == 2 else np.abs(arr)
    total = len(mono_env)
    peaks: list[float] = []
    for idx in range(num_bins):
        start = int((idx * total) // num_bins)
        end = int(((idx + 1) * total) // num_bins)
        if end <= start:
            val = float(mono_env[min(start, total - 1)])
        else:
            val = float(np.max(mono_env[start:end]))
        peaks.append(round(val, 6))
    return peaks


def _slice_and_fade(
    audio_data: np.ndarray,
    sample_rate: int,
    start_sample: int,
    end_sample: int,
    fade_ms: float = 15.0,
) -> dict:
    """Slice audio to [start_sample, end_sample), apply raised-cosine edge fades, and build result metrics."""
    stereo = _ensure_stereo_2d(audio_data)
    total_samples = len(stereo)

    if not (0 <= start_sample < end_sample):
        raise ValueError(_INVALID_BOUNDS_MSG)

    if end_sample > total_samples:
        pad = np.zeros((end_sample - total_samples, 2), dtype=np.float32)
        stereo = np.vstack([stereo, pad])
        total_samples = len(stereo)

    sliced = stereo[start_sample:end_sample].copy()
    fade_samples = max(0, int(round((float(fade_ms) / 1000.0) * sample_rate)))
    fade_samples = min(fade_samples, len(sliced) // 2)

    if fade_samples > 0:
        n = np.arange(fade_samples, dtype=np.float32)
        fade_in = (0.5 * (1.0 - np.cos(np.pi * n / fade_samples)))[:, None]
        fade_out = fade_in[::-1]
        sliced[:fade_samples] *= fade_in
        sliced[-fade_samples:] *= fade_out

    return {
        "trimmed_audio": np.ascontiguousarray(sliced, dtype=np.float32),
        "sample_rate": int(sample_rate),
        "start_sample": int(start_sample),
        "end_sample": int(end_sample),
        "original_duration_sec": float(total_samples / sample_rate),
        "trimmed_duration_sec": float(len(sliced) / sample_rate),
        "lead_in_removed_sec": float(start_sample / sample_rate),
        "tail_removed_sec": float((total_samples - end_sample) / sample_rate),
        "peaks": extract_waveform_peaks(sliced, num_bins=200),
    }


def detect_active_regions(
    audio_data: np.ndarray,
    sample_rate: int,
    threshold_db: float = -45.0,
    min_silence_gap_ms: float = 300.0,
    min_asset_ms: float = 100.0,
    pad_ms: float = 50.0,
) -> list[dict]:
    """Detect non-overlapping active audio regions via 10 ms frame peak envelope, gap bridging, and midpoint-clamped padding."""
    for param in (threshold_db, min_silence_gap_ms, min_asset_ms, pad_ms):
        if not math.isfinite(float(param)):
            raise ValueError(_INVALID_BOUNDS_MSG)

    stereo = _ensure_stereo_2d(audio_data)
    mono_env = np.max(np.abs(stereo), axis=1)
    total_samples = len(mono_env)

    if total_samples == 0 or sample_rate <= 0:
        raise ValueError(_SILENT_AUDIO_MSG)

    win_size = max(1, int(round(0.010 * sample_rate)))
    threshold_amp = 10.0 ** (float(threshold_db) / 20.0)
    n_full = total_samples // win_size

    if n_full > 0:
        frames = mono_env[: n_full * win_size].reshape(n_full, win_size)
        frame_peaks = np.max(frames, axis=1)
    else:
        frame_peaks = np.empty(0, dtype=np.float32)

    if total_samples % win_size > 0:
        tail_peak = float(np.max(mono_env[n_full * win_size :]))
        frame_peaks = np.append(frame_peaks, tail_peak)

    active = frame_peaks >= threshold_amp
    if not np.any(active):
        raise ValueError(_SILENT_AUDIO_MSG)

    padded_mask = np.concatenate(([False], active, [False]))
    diffs = np.diff(padded_mask.astype(np.int8))
    starts = np.where(diffs == 1)[0]
    ends = np.where(diffs == -1)[0]
    raw_runs = list(zip(starts.tolist(), ends.tolist()))

    min_gap_samples = max(0, int(round((max(0.0, float(min_silence_gap_ms)) / 1000.0) * sample_rate)))
    bridged_runs: list[tuple[int, int]] = [raw_runs[0]]
    for start_f, end_f in raw_runs[1:]:
        prev_start_f, prev_end_f = bridged_runs[-1]
        gap_samples = (start_f - prev_end_f) * win_size
        if gap_samples < min_gap_samples:
            bridged_runs[-1] = (prev_start_f, end_f)
        else:
            bridged_runs.append((start_f, end_f))

    min_asset_samples = max(1, int(round((max(0.0, float(min_asset_ms)) / 1000.0) * sample_rate)))
    filtered_runs: list[tuple[int, int]] = []
    for start_f, end_f in bridged_runs:
        start_sample = start_f * win_size
        end_sample = min(total_samples, end_f * win_size)
        if (end_sample - start_sample) >= min_asset_samples:
            filtered_runs.append((start_sample, end_sample))

    if not filtered_runs:
        raise ValueError(_SILENT_AUDIO_MSG)

    pad_samples = max(0, int(round((max(0.0, float(pad_ms)) / 1000.0) * sample_rate)))
    padded_bounds = [
        [max(0, raw_s - pad_samples), min(total_samples, raw_e + pad_samples), raw_s, raw_e]
        for raw_s, raw_e in filtered_runs
    ]
    for idx in range(len(padded_bounds) - 1):
        if padded_bounds[idx][1] > padded_bounds[idx + 1][0]:
            gap_mid = (padded_bounds[idx][3] + padded_bounds[idx + 1][2]) // 2
            padded_bounds[idx][1] = gap_mid
            padded_bounds[idx + 1][0] = gap_mid

    return [
        {
            "start_sec": round(float(s / sample_rate), 6),
            "end_sec": round(float(e / sample_rate), 6),
            "duration_sec": round(float((e - s) / sample_rate), 6),
        }
        for s, e, _, _ in padded_bounds
    ]


def _sanitize_asset_name(raw_name: object, idx: int) -> str:
    """Sanitize a region asset name into a safe filename stem without .wav extension."""
    text = str(raw_name or "").strip().replace("\\", "/")
    segment = text.split("/")[-1].strip() if text else ""
    if segment in ("", ".", ".."):
        return f"asset_{idx + 1}"

    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "_", segment)
    while ".." in cleaned:
        cleaned = cleaned.replace("..", ".")
    if cleaned.lower().endswith(".wav"):
        cleaned = cleaned[:-4]
    cleaned = cleaned.strip("._-")

    if not cleaned or cleaned in (".", ".."):
        return f"asset_{idx + 1}"
    return cleaned


def split_audio_by_regions(
    audio_data: np.ndarray,
    sample_rate: int,
    regions: list[dict],
    fade_ms: float = 15.0,
) -> list[dict]:
    """Slice audio into 1..100 validated regions with sanitized deduplicated names and 24-bit PCM WAV output."""
    if not isinstance(regions, list) or not (1 <= len(regions) <= 100):
        raise ValueError(_INVALID_REGION_COUNT_MSG)

    if not math.isfinite(float(fade_ms)) or float(fade_ms) < 0.0:
        raise ValueError(_INVALID_BOUNDS_MSG)

    stereo = _ensure_stereo_2d(audio_data)
    total_samples = len(stereo)
    if total_samples == 0 or sample_rate <= 0:
        raise ValueError(_CORRUPT_AUDIO_MSG)

    total_duration = total_samples / sample_rate
    used_names: set[str] = set()
    assets: list[dict] = []

    for idx, region in enumerate(regions):
        if not isinstance(region, dict):
            raise ValueError(_INVALID_BOUNDS_MSG)

        raw_start = region.get("start_sec") if "start_sec" in region else region.get("startSec")
        raw_end = region.get("end_sec") if "end_sec" in region else region.get("endSec")
        try:
            start_sec = float(raw_start)
            end_sec = float(raw_end)
        except (TypeError, ValueError) as exc:
            raise ValueError(_INVALID_BOUNDS_MSG) from exc

        if not (math.isfinite(start_sec) and math.isfinite(end_sec)):
            raise ValueError(_INVALID_BOUNDS_MSG)

        if not (0.0 <= start_sec < end_sec <= total_duration + _END_BOUND_TOLERANCE_SEC):
            raise ValueError(_INVALID_BOUNDS_MSG)

        effective_end_sec = min(end_sec, total_duration)
        if (effective_end_sec - start_sec) < (_MIN_REGION_DURATION_SEC - 1e-9):
            raise ValueError(_INVALID_BOUNDS_MSG)

        start_sample = max(0, min(total_samples, int(round(start_sec * sample_rate))))
        end_sample = max(0, min(total_samples, int(round(end_sec * sample_rate))))
        if not (0 <= start_sample < end_sample <= total_samples):
            raise ValueError(_INVALID_BOUNDS_MSG)

        base_name = _sanitize_asset_name(region.get("name"), idx)
        candidate = base_name
        suffix_num = 1
        while candidate.lower() in used_names:
            candidate = f"{base_name}_{suffix_num}"
            suffix_num += 1
        used_names.add(candidate.lower())

        sliced_res = _slice_and_fade(stereo, sample_rate, start_sample, end_sample, fade_ms=float(fade_ms))
        wav_bytes = encode_wav_bytes(sliced_res["trimmed_audio"], int(sample_rate), subtype="PCM_24")

        assets.append({
            "name": candidate,
            "file_name": f"{candidate}.wav",
            "wav_bytes": wav_bytes,
            "start_sec": round(float(start_sample / sample_rate), 6),
            "end_sec": round(float(end_sample / sample_rate), 6),
            "duration_sec": round(float(sliced_res["trimmed_duration_sec"]), 6),
        })

    return assets
