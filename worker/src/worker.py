import os
import sys
import json
import io
import redis
import boto3
import soundfile as sf
from dotenv import load_dotenv

from .ai.instrument_classifier import classify_track
from .ai.pairing_detector import detect_track_pairs

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
    Processes audio stems for a session:
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

    elif "--classify-json" in sys.argv:
        idx = sys.argv.index("--classify-json")
        if idx + 1 < len(sys.argv):
            payload = json.loads(sys.argv[idx + 1])
            tracks = payload.get("tracks", [])
            output = classify_session_tracks(tracks)
            print(json.dumps(output))
            sys.exit(0)

    else:
        print("[Polaris Audio Worker] Background worker ready.")
        test_connections()
