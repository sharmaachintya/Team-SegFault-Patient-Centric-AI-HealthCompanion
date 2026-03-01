"""Storage backends for AI Health Companion - Local (dev) and DynamoDB (prod)."""
import json
import os
import uuid
from datetime import datetime, timezone, timedelta
from abc import ABC, abstractmethod
from typing import Optional

# IST timezone (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

def now_ist() -> str:
    """Return current IST timestamp as ISO format string."""
    return datetime.now(IST).strftime("%Y-%m-%dT%H:%M:%S.%f")

from typing import Union
from database.models import HealthProfile, Medication, TimelineEvent, ChatMessage


class StorageBackend(ABC):
    """Abstract storage backend."""

    @abstractmethod
    async def get_profile(self, patient_id: str) -> Optional[dict]:
        pass

    @abstractmethod
    async def save_profile(self, patient_id: str, profile: dict) -> dict:
        pass

    @abstractmethod
    async def get_timeline(self, patient_id: str, limit: int = 50) -> list[dict]:
        pass

    @abstractmethod
    async def add_timeline_event(self, patient_id: str, event: dict) -> dict:
        pass

    @abstractmethod
    async def delete_timeline_event(self, patient_id: str, event_id: str) -> bool:
        pass

    @abstractmethod
    async def get_conversations(self, patient_id: str, limit: int = 20) -> list[dict]:
        pass

    @abstractmethod
    async def save_message(self, patient_id: str, message: dict) -> dict:
        pass

    @abstractmethod
    async def clear_conversations(self, patient_id: str) -> bool:
        pass


class LocalStorage(StorageBackend):
    """JSON file-based storage for local development."""

    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)

    def _get_path(self, collection: str, patient_id: str) -> str:
        patient_dir = os.path.join(self.data_dir, patient_id)
        os.makedirs(patient_dir, exist_ok=True)
        return os.path.join(patient_dir, f"{collection}.json")

    def _read_json(self, path: str) -> Union[dict, list, None]:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    def _write_json(self, path: str, data):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str, ensure_ascii=False)

    async def get_profile(self, patient_id: str) -> Optional[dict]:
        path = self._get_path("profile", patient_id)
        return self._read_json(path)

    async def save_profile(self, patient_id: str, profile: dict) -> dict:
        path = self._get_path("profile", patient_id)
        now = now_ist()
        existing = self._read_json(path)
        if existing:
            profile["created_at"] = existing.get("created_at", now)
        else:
            profile["created_at"] = now
        profile["updated_at"] = now
        profile["patient_id"] = patient_id
        self._write_json(path, profile)
        return profile

    async def get_timeline(self, patient_id: str, limit: int = 50) -> list[dict]:
        path = self._get_path("timeline", patient_id)
        events = self._read_json(path) or []
        events.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return events[:limit]

    async def add_timeline_event(self, patient_id: str, event: dict) -> dict:
        path = self._get_path("timeline", patient_id)
        events = self._read_json(path) or []
        event["event_id"] = event.get("event_id") or str(uuid.uuid4())
        event["patient_id"] = patient_id
        event["timestamp"] = event.get("timestamp") or now_ist()
        events.append(event)
        self._write_json(path, events)
        return event

    async def delete_timeline_event(self, patient_id: str, event_id: str) -> bool:
        path = self._get_path("timeline", patient_id)
        events = self._read_json(path) or []
        filtered = [e for e in events if e.get("event_id") != event_id]
        if len(filtered) < len(events):
            self._write_json(path, filtered)
            return True
        return False

    async def get_conversations(self, patient_id: str, limit: int = 20) -> list[dict]:
        path = self._get_path("conversations", patient_id)
        messages = self._read_json(path) or []
        return messages[-limit:]

    async def save_message(self, patient_id: str, message: dict) -> dict:
        path = self._get_path("conversations", patient_id)
        messages = self._read_json(path) or []
        message["message_id"] = message.get("message_id") or str(uuid.uuid4())
        message["patient_id"] = patient_id
        message["timestamp"] = message.get("timestamp") or now_ist()
        messages.append(message)
        self._write_json(path, messages)
        return message

    async def clear_conversations(self, patient_id: str) -> bool:
        path = self._get_path("conversations", patient_id)
        self._write_json(path, [])
        return True


class DynamoDBStorage(StorageBackend):
    """DynamoDB-based storage for AWS deployment."""

    def __init__(self, region: str, table_profiles: str, table_timeline: str, table_conversations: str):
        import boto3
        self.dynamodb = boto3.resource("dynamodb", region_name=region)
        self.profiles_table = self.dynamodb.Table(table_profiles)
        self.timeline_table = self.dynamodb.Table(table_timeline)
        self.conversations_table = self.dynamodb.Table(table_conversations)

    async def get_profile(self, patient_id: str) -> Optional[dict]:
        try:
            response = self.profiles_table.get_item(Key={"patient_id": patient_id})
            return response.get("Item")
        except Exception:
            return None

    async def save_profile(self, patient_id: str, profile: dict) -> dict:
        now = datetime.utcnow().isoformat()
        existing = await self.get_profile(patient_id)
        if existing:
            profile["created_at"] = existing.get("created_at", now)
        else:
            profile["created_at"] = now
        profile["updated_at"] = now
        profile["patient_id"] = patient_id

        # Convert Medication objects to dicts for DynamoDB
        if "medications" in profile and profile["medications"]:
            meds = []
            for m in profile["medications"]:
                if isinstance(m, dict):
                    meds.append(m)
                else:
                    meds.append(m if isinstance(m, dict) else dict(m))
            profile["medications"] = meds

        self.profiles_table.put_item(Item=profile)
        return profile

    async def get_timeline(self, patient_id: str, limit: int = 50) -> list[dict]:
        try:
            response = self.timeline_table.query(
                KeyConditionExpression="patient_id = :pid",
                ExpressionAttributeValues={":pid": patient_id},
                ScanIndexForward=False,
                Limit=limit
            )
            return response.get("Items", [])
        except Exception:
            return []

    async def add_timeline_event(self, patient_id: str, event: dict) -> dict:
        event["event_id"] = event.get("event_id") or str(uuid.uuid4())
        event["patient_id"] = patient_id
        event["timestamp"] = event.get("timestamp") or datetime.utcnow().isoformat()
        self.timeline_table.put_item(Item=event)
        return event

    async def delete_timeline_event(self, patient_id: str, event_id: str) -> bool:
        try:
            self.timeline_table.delete_item(
                Key={"patient_id": patient_id, "event_id": event_id}
            )
            return True
        except Exception:
            return False

    async def get_conversations(self, patient_id: str, limit: int = 20) -> list[dict]:
        try:
            response = self.conversations_table.query(
                KeyConditionExpression="patient_id = :pid",
                ExpressionAttributeValues={":pid": patient_id},
                ScanIndexForward=True,
                Limit=limit
            )
            items = response.get("Items", [])
            return items[-limit:]
        except Exception:
            return []

    async def save_message(self, patient_id: str, message: dict) -> dict:
        message["message_id"] = message.get("message_id") or str(uuid.uuid4())
        message["patient_id"] = patient_id
        message["timestamp"] = message.get("timestamp") or datetime.utcnow().isoformat()
        self.conversations_table.put_item(Item=message)
        return message

    async def clear_conversations(self, patient_id: str) -> bool:
        try:
            response = self.conversations_table.query(
                KeyConditionExpression="patient_id = :pid",
                ExpressionAttributeValues={":pid": patient_id}
            )
            for item in response.get("Items", []):
                self.conversations_table.delete_item(
                    Key={"patient_id": patient_id, "message_id": item["message_id"]}
                )
            return True
        except Exception:
            return False


def create_storage(config) -> StorageBackend:
    """Factory function to create the appropriate storage backend."""
    if config.STORAGE_MODE == "aws":
        return DynamoDBStorage(
            region=config.AWS_REGION,
            table_profiles=config.DYNAMODB_TABLE_PROFILES,
            table_timeline=config.DYNAMODB_TABLE_TIMELINE,
            table_conversations=config.DYNAMODB_TABLE_CONVERSATIONS,
        )
    else:
        return LocalStorage(data_dir=config.LOCAL_DATA_DIR)
