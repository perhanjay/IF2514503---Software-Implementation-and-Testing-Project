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
_SILENT_AUDIO_MSG = "Audio sepenuhnya hening di bawah ambang batas yang dipilih"


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
        )
        if proc.returncode != 0:
            raise ValueError(_CORRUPT_AUDIO_MSG)

        audio, sr = sf.read(out_path, dtype="float32", always_2d=True)
        return audio, int(sr)
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


def encode_wav_bytes(audio_data: np.ndarray, sample_rate: int = TARGET_SAMPLE_RATE) -> bytes:
    """Encode float32 stereo audio array into WAV bytes."""
    stereo = _ensure_stereo_2d(audio_data)
    buf = io.BytesIO()
    sf.write(buf, stereo, int(sample_rate), format="WAV", subtype="FLOAT")
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


def find_trim_sample_bounds(
    audio_data: np.ndarray,
    sample_rate: int,
    threshold_db: float = -45.0,
    pad_ms: float = 100.0,
    manual_start_sec: float | None = None,
    manual_end_sec: float | None = None,
) -> tuple[int, int]:
    """Determine sample-accurate [start, end) trim bounds via 10 ms RMS threshold or manual overrides."""
    arr = np.asarray(audio_data, dtype=np.float32)
    mono_env = np.max(np.abs(arr), axis=1) if arr.ndim == 2 else np.abs(arr)
    total_samples = len(mono_env)

    if total_samples == 0 or sample_rate <= 0:
        raise ValueError(_SILENT_AUDIO_MSG)

    if manual_start_sec is not None and manual_end_sec is not None:
        start_idx = int(round(float(manual_start_sec) * sample_rate))
        end_idx = int(round(float(manual_end_sec) * sample_rate))
        if not (0 <= start_idx < end_idx <= total_samples):
            raise ValueError(_INVALID_BOUNDS_MSG)
        return start_idx, end_idx

    win_size = max(1, int(round(0.010 * sample_rate)))
    threshold_amp = 10.0 ** (float(threshold_db) / 20.0)
    n_full = total_samples // win_size

    if n_full > 0:
        frames = mono_env[: n_full * win_size].reshape(n_full, win_size)
        frame_rms = np.sqrt(np.mean(frames.astype(np.float64) ** 2, axis=1))
    else:
        frame_rms = np.empty(0, dtype=np.float64)

    if total_samples % win_size > 0:
        tail_rms = float(np.sqrt(np.mean(mono_env[n_full * win_size :].astype(np.float64) ** 2)))
        frame_rms = np.append(frame_rms, tail_rms)

    active_frames = np.where(frame_rms > threshold_amp)[0]
    if len(active_frames) == 0:
        raise ValueError(_SILENT_AUDIO_MSG)

    first_active = int(active_frames[0]) * win_size
    last_active = min(total_samples, (int(active_frames[-1]) + 1) * win_size)
    pad_samples = max(0, int(round((float(pad_ms) / 1000.0) * sample_rate)))

    auto_start = max(0, first_active - pad_samples)
    auto_end = min(total_samples, last_active + pad_samples)

    start_idx = int(round(float(manual_start_sec) * sample_rate)) if manual_start_sec is not None else auto_start
    end_idx = int(round(float(manual_end_sec) * sample_rate)) if manual_end_sec is not None else auto_end

    if not (0 <= start_idx < end_idx <= total_samples):
        raise ValueError(_INVALID_BOUNDS_MSG)

    return start_idx, end_idx


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


def trim_audio_silence(
    audio_data: np.ndarray,
    sample_rate: int,
    threshold_db: float = -45.0,
    pad_ms: float = 100.0,
    fade_ms: float = 15.0,
    manual_start_sec: float | None = None,
    manual_end_sec: float | None = None,
) -> dict:
    """Trim leading and trailing silence from a single audio array with zero-crossing fade edges."""
    stereo = _ensure_stereo_2d(audio_data)
    start_idx, end_idx = find_trim_sample_bounds(
        stereo,
        sample_rate,
        threshold_db=threshold_db,
        pad_ms=pad_ms,
        manual_start_sec=manual_start_sec,
        manual_end_sec=manual_end_sec,
    )
    return _slice_and_fade(stereo, sample_rate, start_idx, end_idx, fade_ms=fade_ms)


def compute_union_trim_bounds(
    stems_map: dict[str, np.ndarray],
    sample_rate: int,
    threshold_db: float = -45.0,
    pad_ms: float = 100.0,
    manual_start_sec: float | None = None,
    manual_end_sec: float | None = None,
) -> tuple[int, int]:
    """Compute shared trim bounds across all stems using the frame-wise max union envelope."""
    if not stems_map:
        raise ValueError(_SILENT_AUDIO_MSG)

    max_len = max(len(arr) for arr in stems_map.values())
    if max_len == 0:
        raise ValueError(_SILENT_AUDIO_MSG)

    union_env = np.zeros(max_len, dtype=np.float32)
    for arr in stems_map.values():
        arr_f = np.asarray(arr, dtype=np.float32)
        env = np.max(np.abs(arr_f), axis=1) if arr_f.ndim == 2 else np.abs(arr_f)
        if len(env) > 0:
            union_env[: len(env)] = np.maximum(union_env[: len(env)], env)

    return find_trim_sample_bounds(
        union_env[:, None],
        sample_rate,
        threshold_db=threshold_db,
        pad_ms=pad_ms,
        manual_start_sec=manual_start_sec,
        manual_end_sec=manual_end_sec,
    )


def slice_aligned_batch(
    stems_map: dict[str, np.ndarray],
    sample_rate: int,
    start_sample: int,
    end_sample: int,
    fade_ms: float = 15.0,
) -> dict[str, dict]:
    """Slice all stems in stems_map at identical sample boundaries so timing alignment stays locked."""
    return {
        name: _slice_and_fade(audio, sample_rate, start_sample, end_sample, fade_ms=fade_ms)
        for name, audio in stems_map.items()
    }
