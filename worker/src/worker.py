import os
import sys
import json
import io
import redis
import boto3
import soundfile as sf
import numpy as np
from dotenv import load_dotenv

try:
    from .ai.instrument_classifier import classify_track
    from .ai.pairing_detector import detect_track_pairs
    from .dsp.phase_analyzer import (
        compute_stereo_correlation,
        compute_mono_cancellation_loss,
        detect_fake_stereo,
        analyze_track_pair_phase
    )
    from .dsp.signal_metrics import analyze_track_signals
    from .dsp.health_score import calculate_track_health, calculate_session_health
except (ImportError, ValueError):
    from ai.instrument_classifier import classify_track
    from ai.pairing_detector import detect_track_pairs
    from dsp.phase_analyzer import (
        compute_stereo_correlation,
        compute_mono_cancellation_loss,
        detect_fake_stereo,
        analyze_track_pair_phase
    )
    from dsp.signal_metrics import analyze_track_signals
    from dsp.health_score import calculate_track_health, calculate_session_health

load_dotenv()

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY_ID", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_ACCESS_KEY", "minioadmin")
S3_BUCKET = os.getenv("S3_BUCKET_NAME", "polaris-audio-stems")

def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name="us-east-1"
    )

def test_connections():
    print("--- [Polaris Audio Worker Sanity Check] ---")
    # 1. Test Redis
    try:
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        r.ping()
        print("✓ Redis Connection: CONNECTED (Queue ready)")
    except Exception as e:
        print(f"✗ Redis Connection ERROR: {e}")
        return False

    # 2. Test S3 / MinIO
    try:
        s3 = get_s3_client()
        buckets = [b["Name"] for b in s3.list_buckets().get("Buckets", [])]
        print(f"✓ MinIO / S3 Connection: CONNECTED (Found buckets: {buckets})")
    except Exception as e:
        print(f"✗ MinIO / S3 Connection ERROR: {e}")
        return False

    print("--- Worker Environment Ready for Phase 4 DSP/AI Engines ---")
    return True

def classify_session_tracks(tracks_data):
    """
    Processes audio stems for a session (UC-12):
    1. Fetches audio from MinIO S3 bucket.
    2. Runs Mel-Spectrogram & Audio Instrument Classifier.
    3. Runs Pairing Detector to find multi-mic pairs.
    """
    s3 = get_s3_client()
    classified_tracks = []

    for item in tracks_data:
        track_id = item.get("id")
        file_name = item.get("fileName", "track.wav")
        storage_key = item.get("originalStorageKey")

        if not storage_key:
            continue

        try:
            # Download audio from MinIO
            s3_obj = s3.get_object(Bucket=S3_BUCKET, Key=storage_key)
            audio_bytes = s3_obj['Body'].read()

            with sf.SoundFile(io.BytesIO(audio_bytes)) as snd:
                sample_rate = snd.samplerate
                audio_data = snd.read(dtype='float32')

            # Run classifier
            result = classify_track(audio_data, sample_rate, file_name=file_name)
            classified_tracks.append({
                "trackId": track_id,
                "fileName": file_name,
                "detectedLabel": result["detected_label"],
                "confidenceScore": result["confidence_score"],
                "needsReview": result["needs_review"],
                "spectralSummary": result["spectral_summary"]
            })
        except Exception as err:
            sys.stderr.write(f"Error processing track {track_id} ({file_name}): {err}\n")
            classified_tracks.append({
                "trackId": track_id,
                "fileName": file_name,
                "detectedLabel": "Other",
                "confidenceScore": 0.50,
                "needsReview": True,
                "error": str(err)
            })

    # Detect pairs across all classified tracks
    detected_pairs = detect_track_pairs(classified_tracks)

    return {
        "classifiedTracks": classified_tracks,
        "detectedPairs": detected_pairs
    }

def diagnose_session_tracks(tracks_data, pairs_data=None):
    """
    Executes Core DSP Diagnostics Engine for Session Tracks (UC-13):
    1. Downloads audio stems from MinIO.
    2. Computes True-Peak (4x oversampled), Clipping, Crest Factor, DC Offset, Sub-Rumble.
    3. Computes Stereo Correlation & Haas Fake Stereo for stereo files.
    4. Computes Multi-mic cross-correlation, polarity inversion, comb filtering for pairs.
    5. Calculates Mix Health Score (0-100) and actionable recommendations.
    """
    if pairs_data is None:
        pairs_data = []

    s3 = get_s3_client()
    audio_map = {}
    raw_track_metrics = {}

    # 1. Download & Compute Single Track Metrics
    for item in tracks_data:
        track_id = item.get("id")
        file_name = item.get("fileName", "track.wav")
        storage_key = item.get("originalStorageKey")
        instrument_label = item.get("instrumentLabel") or item.get("detectedLabel") or "Other"

        if not storage_key:
            continue

        try:
            s3_obj = s3.get_object(Bucket=S3_BUCKET, Key=storage_key)
            audio_bytes = s3_obj['Body'].read()

            with sf.SoundFile(io.BytesIO(audio_bytes)) as snd:
                sample_rate = snd.samplerate
                audio_data = snd.read(dtype='float32')
                channels = snd.channels

            audio_map[track_id] = {
                "audio": audio_data,
                "sr": sample_rate,
                "fileName": file_name,
                "channels": channels
            }

            # Single track signal metrics
            sig_metrics = analyze_track_signals(audio_data, sample_rate, instrument_label=instrument_label)

            # Stereo Phase Analysis
            stereo_corr = 1.0
            fake_stereo_info = {"has_fake_stereo": False, "is_haas_effect": False, "haas_delay_ms": 0.0}

            if channels == 2 and audio_data.ndim == 2:
                left = audio_data[:, 0]
                right = audio_data[:, 1]
                stereo_corr = compute_stereo_correlation(left, right)
                fake_stereo_info = detect_fake_stereo(left, right, sample_rate)

            raw_track_metrics[track_id] = {
                "trackId": track_id,
                "fileName": file_name,
                "channels": channels,
                "phaseCorrelation": stereo_corr,
                "hasFakeStereo": fake_stereo_info.get("has_fake_stereo", False),
                "haasDelayMs": fake_stereo_info.get("haas_delay_ms", 0.0),
                "truePeakDbfs": sig_metrics["true_peak_dbfs"],
                "isClipping": sig_metrics["is_clipping"],
                "clampedEventCount": sig_metrics["clamped_event_count"],
                "crestFactor": sig_metrics["crest_factor_db"],
                "hasDcOffset": sig_metrics["has_dc_offset"],
                "dcOffsetPct": sig_metrics["dc_offset_pct"],
                "hasSubRumble": sig_metrics["has_sub_rumble"],
                "subEnergyRatio": sig_metrics["sub_energy_ratio"],
                "peakDbfs": sig_metrics["peak_dbfs"],
                "rmsDbfs": sig_metrics["rms_dbfs"]
            }

        except Exception as err:
            sys.stderr.write(f"Error diagnosing track {track_id} ({file_name}): {err}\n")
            raw_track_metrics[track_id] = {
                "trackId": track_id,
                "fileName": file_name,
                "channels": 1,
                "phaseCorrelation": 1.0,
                "hasFakeStereo": False,
                "haasDelayMs": 0.0,
                "truePeakDbfs": -6.0,
                "isClipping": False,
                "clampedEventCount": 0,
                "crestFactor": 12.0,
                "hasDcOffset": False,
                "dcOffsetPct": 0.0,
                "hasSubRumble": False,
                "subEnergyRatio": 0.0,
                "error": str(err)
            }

    # 2. Compute Paired Track Metrics (Multi-mic, Snare Top/Btm, Kick In/Sub, Bass DI/Mic)
    pairs_diagnostics = []
    track_pair_associations = {}

    for pair in pairs_data:
        pair_id = pair.get("id")
        track_a_id = pair.get("trackAId")
        track_b_id = pair.get("trackBId")
        pair_type = pair.get("pairType", "MIC_PAIR")

        if track_a_id in audio_map and track_b_id in audio_map:
            item_a = audio_map[track_a_id]
            item_b = audio_map[track_b_id]

            pair_res = analyze_track_pair_phase(
                item_a["audio"],
                item_b["audio"],
                item_a["sr"],
                pair_type=pair_type
            )

            diag_entry = {
                "pairId": pair_id,
                "trackAId": track_a_id,
                "trackBId": track_b_id,
                "pairType": pair_type,
                "trackAName": item_a["fileName"],
                "trackBName": item_b["fileName"],
                "correlation": pair_res["correlation"],
                "peakCorrelation": pair_res["peak_correlation"],
                "hasPolarityInvert": pair_res["has_polarity_invert"],
                "delaySamples": pair_res["delay_samples"],
                "delayMs": pair_res["delay_ms"],
                "hasCombFiltering": pair_res["has_comb_filtering"]
            }
            pairs_diagnostics.append(diag_entry)

            # Associate to track B (secondary microphone) and track A
            track_pair_associations[track_b_id] = {
                "pairedTrackId": track_a_id,
                "pairedTrackName": item_a["fileName"],
                "has_polarity_invert": pair_res["has_polarity_invert"],
                "has_comb_filtering": pair_res["has_comb_filtering"],
                "delay_ms": pair_res["delay_ms"],
                "delay_samples": pair_res["delay_samples"]
            }
            track_pair_associations[track_a_id] = {
                "pairedTrackId": track_b_id,
                "pairedTrackName": item_b["fileName"],
                "has_polarity_invert": pair_res["has_polarity_invert"],
                "has_comb_filtering": pair_res["has_comb_filtering"],
                "delay_ms": -pair_res["delay_ms"],
                "delay_samples": -pair_res["delay_samples"]
            }

    # 3. Compute Track Health & Recommendations
    tracks_diagnostics = []
    track_health_list = []

    for track_id, m in raw_track_metrics.items():
        pair_assoc = track_pair_associations.get(track_id)
        metric_eval = {
            "fileName": m["fileName"],
            "true_peak_dbfs": m["truePeakDbfs"],
            "is_clipping": m["isClipping"],
            "has_fake_stereo": m["hasFakeStereo"],
            "haas_delay_ms": m["haasDelayMs"],
            "crest_factor_db": m["crestFactor"],
            "has_dc_offset": m["hasDcOffset"],
            "dc_offset_pct": m["dcOffsetPct"],
            "has_sub_rumble": m["hasSubRumble"],
            "sub_energy_ratio": m["subEnergyRatio"],
            "peak_dbfs": m.get("peakDbfs", -12.0)
        }

        health_res = calculate_track_health(metric_eval, pair_assoc)
        track_health_list.append(health_res)

        tracks_diagnostics.append({
            "trackId": track_id,
            "fileName": m["fileName"],
            "phaseCorrelation": m["phaseCorrelation"],
            "hasPolarityInvert": health_res["has_polarity_invert"],
            "hasCombFiltering": health_res["has_comb_filtering"],
            "hasFakeStereo": health_res["has_fake_stereo"],
            "truePeakDbfs": m["truePeakDbfs"],
            "hasClipping": health_res["has_clipping"],
            "crestFactor": m["crestFactor"],
            "hasDcOffset": health_res["has_dc_offset"],
            "hasSubRumble": health_res["has_sub_rumble"],
            "healthStatus": health_res["health_status"],
            "rawMetrics": {
                "channels": m["channels"],
                "peakDbfs": m.get("peakDbfs"),
                "rmsDbfs": m.get("rmsDbfs"),
                "clampedEventCount": m["clampedEventCount"],
                "dcOffsetPct": m["dcOffsetPct"],
                "subEnergyRatio": m["subEnergyRatio"],
                "haasDelayMs": m["haasDelayMs"],
                "pairDelayMs": pair_assoc.get("delay_ms") if pair_assoc else None
            },
            "recommendations": health_res["recommendations"]
        })

    # 4. Calculate Aggregate Mix Health Score
    session_health = calculate_session_health(track_health_list, pairs_diagnostics)

    return {
        "sessionHealth": session_health,
        "tracksDiagnostics": tracks_diagnostics,
        "pairsDiagnostics": pairs_diagnostics
    }

if __name__ == "__main__":
    if "--test" in sys.argv or "--test-connection" in sys.argv:
        success = test_connections()
        sys.exit(0 if success else 1)

    elif "--classify-stdin" in sys.argv:
        input_data = sys.stdin.read()
        payload = json.loads(input_data)
        tracks = payload.get("tracks", [])
        output = classify_session_tracks(tracks)
        print(json.dumps(output))
        sys.exit(0)

    elif "--diagnose-stdin" in sys.argv:
        input_data = sys.stdin.read()
        payload = json.loads(input_data)
        tracks = payload.get("tracks", [])
        pairs = payload.get("pairs", [])
        output = diagnose_session_tracks(tracks, pairs)
        print(json.dumps(output))
        sys.exit(0)

    else:
        print("[Polaris Audio Worker] Background worker ready.")
        test_connections()
