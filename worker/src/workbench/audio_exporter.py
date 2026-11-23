import io
import os
import subprocess
import tempfile

import numpy as np
import soundfile as sf

try:
    from .silence_trimmer import decode_audio_bytes, encode_wav_bytes
except (ImportError, ValueError):
    from workbench.silence_trimmer import decode_audio_bytes, encode_wav_bytes

SUPPORTED_EXPORT_FORMATS = ("wav24", "wav16", "flac24", "flac16", "mp3", "mp3_320")

EXPORT_FORMAT_META = {
    "wav24": {"ext": ".wav", "mime": "audio/wav"},
    "wav16": {"ext": ".wav", "mime": "audio/wav"},
    "flac24": {"ext": ".flac", "mime": "audio/flac"},
    "flac16": {"ext": ".flac", "mime": "audio/flac"},
    "mp3": {"ext": ".mp3", "mime": "audio/mpeg"},
    "mp3_320": {"ext": ".mp3", "mime": "audio/mpeg"},
}


def _encode_mp3_bytes(audio_data: np.ndarray, sample_rate: int, bitrate_kbps: int) -> bytes:
    """Encode stereo float32 array to MP3 using ffmpeg libmp3lame."""
    safe_bitrate = max(128, min(320, int(bitrate_kbps or 320)))
    clipped = np.clip(audio_data, -1.0, 1.0)
    in_path = None
    out_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as in_tmp:
            in_path = in_tmp.name
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as out_tmp:
            out_path = out_tmp.name

        sf.write(in_path, clipped, int(sample_rate), format="WAV", subtype="PCM_24")

        proc = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-nostdin",
                "-loglevel",
                "error",
                "-i",
                in_path,
                "-codec:a",
                "libmp3lame",
                "-b:a",
                f"{safe_bitrate}k",
                out_path,
            ],
            capture_output=True,
            check=False,
            timeout=90,
        )
        if proc.returncode != 0 or not os.path.exists(out_path):
            stderr_msg = proc.stderr.decode("utf-8", errors="ignore").strip()
            raise ValueError(f"Gagal mengonversi audio ke MP3: {stderr_msg or 'ffmpeg error'}")

        with open(out_path, "rb") as f:
            data = f.read()
        if not data:
            raise ValueError("Berkas hasil konversi MP3 kosong")
        return data
    except subprocess.TimeoutExpired as exc:
        raise ValueError("Proses konversi MP3 melebihi batas waktu") from exc
    except FileNotFoundError as exc:
        raise ValueError("Encoder MP3 (ffmpeg) tidak tersedia di server") from exc
    finally:
        for p in (in_path, out_path):
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass


def transcode_audio_bytes(
    raw_bytes: bytes,
    target_format: str,
    bitrate_kbps: int | None = None,
    file_name: str = "audio.wav",
) -> dict:
    """Transcode workbench audio bytes to the requested export format."""
    fmt = (target_format or "wav24").lower().strip()
    if fmt not in EXPORT_FORMAT_META:
        raise ValueError(f"Format ekspor tidak didukung: {target_format}")

    audio_data, sr = decode_audio_bytes(raw_bytes, file_name)
    meta = EXPORT_FORMAT_META[fmt]

    if fmt in ("wav24", "wav16"):
        subtype = "PCM_24" if fmt == "wav24" else "PCM_16"
        out_bytes = encode_wav_bytes(audio_data, sr, subtype=subtype)
    elif fmt in ("flac24", "flac16"):
        subtype = "PCM_24" if fmt == "flac24" else "PCM_16"
        buf = io.BytesIO()
        sf.write(buf, np.clip(audio_data, -1.0, 1.0), int(sr), format="FLAC", subtype=subtype)
        out_bytes = buf.getvalue()
    else:
        resolved_bitrate = 320 if fmt == "mp3_320" else (bitrate_kbps or 320)
        out_bytes = _encode_mp3_bytes(audio_data, sr, resolved_bitrate)

    return {
        "bytes": out_bytes,
        "ext": meta["ext"],
        "mime": meta["mime"],
        "format": fmt,
    }
