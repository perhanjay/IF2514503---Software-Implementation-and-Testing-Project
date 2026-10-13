import os
import sys
import redis
import boto3
from dotenv import load_dotenv

load_dotenv()

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY_ID", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_ACCESS_KEY", "minioadmin")
S3_BUCKET = os.getenv("S3_BUCKET_NAME", "polaris-audio-stems")

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
        s3 = boto3.client(
            "s3",
            endpoint_url=S3_ENDPOINT,
            aws_access_key_id=S3_ACCESS_KEY,
            aws_secret_access_key=S3_SECRET_KEY,
            region_name="us-east-1"
        )
        buckets = [b["Name"] for b in s3.list_buckets().get("Buckets", [])]
        print(f"✓ MinIO / S3 Connection: CONNECTED (Found buckets: {buckets})")
    except Exception as e:
        print(f"✗ MinIO / S3 Connection ERROR: {e}")
        return False

    print("--- Worker Environment Ready for Phase 4 DSP/AI Engines ---")
    return True

if __name__ == "__main__":
    if "--test" in sys.argv or "--test-connection" in sys.argv:
        success = test_connections()
        sys.exit(0 if success else 1)
    else:
        print("[Polaris Audio Worker] Starting background worker listener...")
        test_connections()
