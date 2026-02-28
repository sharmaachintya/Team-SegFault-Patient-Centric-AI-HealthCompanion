"""Configuration for AI Health Companion."""
import os


class Config:
    # AI Provider: "anthropic" for direct Anthropic API, "bedrock" for AWS Bedrock
    AI_PROVIDER = os.getenv("AI_PROVIDER", "anthropic")

    # Anthropic Direct API Settings
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")

    # AWS Bedrock Settings
    AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
    BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "apac.anthropic.claude-3-5-sonnet-20241022-v2:0")

    # DynamoDB Tables
    DYNAMODB_TABLE_PROFILES = os.getenv("DYNAMODB_TABLE_PROFILES", "HealthCompanion_Profiles")
    DYNAMODB_TABLE_TIMELINE = os.getenv("DYNAMODB_TABLE_TIMELINE", "HealthCompanion_Timeline")
    DYNAMODB_TABLE_CONVERSATIONS = os.getenv("DYNAMODB_TABLE_CONVERSATIONS", "HealthCompanion_Conversations")

    # S3
    S3_BUCKET = os.getenv("S3_BUCKET", "health-companion-images")

    # Storage mode: "local" for development, "aws" for production
    STORAGE_MODE = os.getenv("STORAGE_MODE", "local")

    # Server
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "8000"))

    # Local storage path (for development)
    LOCAL_DATA_DIR = os.getenv("LOCAL_DATA_DIR", "./data")


config = Config()
