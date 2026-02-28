"""Amazon S3 integration for image storage."""
import os
import uuid
import json
import logging
from datetime import datetime
from config import config

logger = logging.getLogger(__name__)


class ImageStorage:
    """Handles image storage - S3 for AWS, local filesystem for dev."""

    def __init__(self):
        self.mode = config.STORAGE_MODE
        if self.mode == "aws":
            import boto3
            self.s3 = boto3.client("s3", region_name=config.AWS_REGION)
            self.bucket = config.S3_BUCKET
        else:
            self.local_dir = os.path.join(config.LOCAL_DATA_DIR, "images")
            os.makedirs(self.local_dir, exist_ok=True)

    async def upload_image(self, patient_id: str, image_bytes: bytes, content_type: str = "image/jpeg") -> dict:
        """Upload an image and return metadata."""
        image_id = str(uuid.uuid4())
        ext = content_type.split("/")[-1] if "/" in content_type else "jpg"
        key = f"images/{patient_id}/{image_id}.{ext}"
        timestamp = datetime.utcnow().isoformat()

        if self.mode == "aws":
            try:
                self.s3.put_object(
                    Bucket=self.bucket,
                    Key=key,
                    Body=image_bytes,
                    ContentType=content_type,
                    Metadata={
                        "patient_id": patient_id,
                        "upload_time": timestamp,
                    }
                )
                logger.info(f"Uploaded image to S3: {key}")
            except Exception as e:
                logger.error(f"S3 upload error: {e}")
                raise
        else:
            # Local storage
            patient_dir = os.path.join(self.local_dir, patient_id)
            os.makedirs(patient_dir, exist_ok=True)
            filepath = os.path.join(patient_dir, f"{image_id}.{ext}")
            with open(filepath, "wb") as f:
                f.write(image_bytes)

            # Save metadata
            meta_path = os.path.join(patient_dir, f"{image_id}_meta.json")
            with open(meta_path, "w") as f:
                json.dump({
                    "image_id": image_id,
                    "patient_id": patient_id,
                    "key": key,
                    "content_type": content_type,
                    "timestamp": timestamp,
                }, f, indent=2)

            logger.info(f"Saved image locally: {filepath}")

        return {
            "image_id": image_id,
            "key": key,
            "content_type": content_type,
            "timestamp": timestamp,
        }

    async def get_image(self, key: str) -> bytes:
        """Retrieve image bytes by key."""
        if self.mode == "aws":
            try:
                response = self.s3.get_object(Bucket=self.bucket, Key=key)
                return response["Body"].read()
            except Exception as e:
                logger.error(f"S3 get error: {e}")
                raise
        else:
            # Convert S3 key to local path
            filepath = os.path.join(config.LOCAL_DATA_DIR, key)
            if os.path.exists(filepath):
                with open(filepath, "rb") as f:
                    return f.read()
            raise FileNotFoundError(f"Image not found: {key}")
