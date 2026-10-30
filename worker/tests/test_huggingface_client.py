import pytest
import numpy as np
import io
import soundfile as sf
from unittest.mock import patch, MagicMock
from src.ai.huggingface_client import (
    prepare_audio_for_hf,
    prepare_audio_signal_for_hf,
    map_hf_predictions_to_polaris,
    query_huggingface_model,
    query_local_huggingface_model,
    AUDIOSET_TO_POLARIS
)
from src.ai.instrument_classifier import classify_track

def test_prepare_audio_signal_for_hf():
    sr = 48000
    t = np.linspace(0, 1.0, sr, endpoint=False)
    sig = np.sin(2 * np.pi * 200 * t)
    res_sig, target_sr = prepare_audio_signal_for_hf(sig, sr, target_sr=16000)
    assert target_sr == 16000
    assert isinstance(res_sig, np.ndarray)
    assert len(res_sig) == 16000
    assert np.max(np.abs(res_sig)) <= 1.0

def test_prepare_audio_for_hf():
    # 48 kHz stereo audio 2 seconds
    sr = 48000
    t = np.linspace(0, 2.0, sr * 2, endpoint=False)
    left = np.sin(2 * np.pi * 100 * t)
    right = np.sin(2 * np.pi * 100 * t)
    stereo_data = np.stack([left, right], axis=1)

    wav_bytes = prepare_audio_for_hf(stereo_data, sr, target_sr=16000, max_duration_sec=1.5)
    assert isinstance(wav_bytes, bytes)
    assert len(wav_bytes) > 44  # Valid WAV header

    # Read back and verify sample rate and mono
    with sf.SoundFile(io.BytesIO(wav_bytes)) as snd:
        assert snd.samplerate == 16000
        assert snd.channels == 1
        assert snd.frames <= 16000 * 1.5 + 10

def test_map_hf_predictions_to_polaris():
    # AudioSet predictions mock
    mock_preds = [
        {"label": "Snare drum", "score": 0.85},
        {"label": "Drum kit", "score": 0.10},
        {"label": "Music", "score": 0.05}
    ]
    res = map_hf_predictions_to_polaris(mock_preds)
    assert res is not None
    assert res["detected_label"] == "Drums: Snare"
    assert res["confidence_score"] >= 0.80

    # Guitar mock
    mock_guitar = [
        {"label": "Acoustic guitar", "score": 0.78},
        {"label": "Plucked string instrument", "score": 0.15}
    ]
    res_g = map_hf_predictions_to_polaris(mock_guitar)
    assert res_g["detected_label"] == "Guitars: Acoustic"

def test_query_local_huggingface_model_success():
    mock_pipe = MagicMock()
    mock_pipe.return_value = [
        {"label": "Snare drum", "score": 0.88},
        {"label": "Drum kit", "score": 0.08}
    ]

    sr = 48000
    t = np.linspace(0, 0.5, int(sr * 0.5))
    dummy_audio = np.sin(2 * np.pi * 200 * t)

    with patch("src.ai.huggingface_client.get_local_ast_pipeline", return_value=mock_pipe):
        res = query_local_huggingface_model(dummy_audio, sr)
        assert res is not None
        assert res["detected_label"] == "Drums: Snare"
        assert "huggingface_local" in res["inference_source"]
        assert res["confidence_score"] >= 0.80

def test_query_huggingface_model_prefers_local():
    mock_pipe = MagicMock()
    mock_pipe.return_value = [
        {"label": "Bass guitar", "score": 0.91}
    ]

    sr = 48000
    t = np.linspace(0, 0.5, int(sr * 0.5))
    dummy_audio = np.sin(2 * np.pi * 80 * t)

    with patch("src.ai.huggingface_client.get_local_ast_pipeline", return_value=mock_pipe):
        with patch("requests.post") as mock_req:
            res = query_huggingface_model(dummy_audio, sr, "Bass.wav")
            assert res is not None
            assert res["detected_label"] == "Bass"
            assert "huggingface_local" in res["inference_source"]
            # Remote request shouldn't be executed because local succeeded
            mock_req.assert_not_called()

def test_query_huggingface_model_remote_fallback():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {"label": "Bass drum", "score": 0.92},
        {"label": "Drum machine", "score": 0.05}
    ]

    sr = 48000
    t = np.linspace(0, 0.5, int(sr * 0.5))
    dummy_audio = np.sin(2 * np.pi * 60 * t)

    with patch("src.ai.huggingface_client.get_local_ast_pipeline", return_value=None):
        with patch("requests.post", return_value=mock_response):
            res = query_huggingface_model(dummy_audio, sr, "01_Kick.wav")
            assert res is not None
            assert res["detected_label"] == "Drums: Kick"
            assert "huggingface_remote" in res["inference_source"]

def test_classify_track_with_hf_and_fallback():
    sr = 48000
    t = np.linspace(0, 0.5, int(sr * 0.5))
    dummy_audio = np.sin(2 * np.pi * 440 * t)

    # 1. When HF succeeds
    mock_hf = {
        "detected_label": "Guitars: Electric",
        "confidence_score": 0.88,
        "inference_source": "huggingface_local:MIT/ast-finetuned-audioset-10-10-0.4593"
    }
    with patch("src.ai.instrument_classifier.query_huggingface_model", return_value=mock_hf):
        result = classify_track(dummy_audio, sr, "lead_guitar.wav")
        assert result["detected_label"] == "Guitars: Electric"
        assert result["inference_source"] == "huggingface_local:MIT/ast-finetuned-audioset-10-10-0.4593"
        assert result["confidence_score"] == 0.88

    # 2. When HF fails (None), resilient fallback activates
    kick_signal = np.sin(2 * np.pi * 50 * t) * np.exp(-t * 10)
    with patch("src.ai.instrument_classifier.query_huggingface_model", return_value=None):
        result_fallback = classify_track(kick_signal, sr, "01_Kick_In.wav")
        assert result_fallback is not None
        assert result_fallback["detected_label"] == "Drums: Kick"
        assert result_fallback["inference_source"] == "acoustic_spectral_prior"
