"""
Application Configuration

This module manages all application settings using environment variables
with Pydantic Settings for validation and type safety.
"""

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    
    All settings have sensible defaults for local development,
    but should be overridden via environment variables in production.
    """
    
    # Application
    app_name: str = "AI Assistant Server"
    debug: bool = False
    log_level: str = "INFO"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    # CORS
    cors_origins: str = "*"
    
    # OpenAI API Configuration
    openai_api_key: str = Field(
        default="",
        description="OpenAI API key for making requests"
    )
    openai_base_url: str = "https://api.openai.com/v1"
    openai_default_model: str = "gpt-4o-mini"
    
    # Available models configuration (JSON string)
    available_models: str = """[
        {"id": "gpt-4o", "name": "GPT-4o", "description": "Most capable model for complex tasks"},
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "description": "Fast and cost-effective"},
        {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "description": "Balanced performance"}
    ]"""
    
    # Database
    database_url: str = "sqlite+aiosqlite:///./data/ai_assistant.db"
    
    # Streaming
    stream_chunk_size: int = 50
    stream_delay_ms: int = 50
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        if self.cors_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    @property
    def models_config(self) -> List[dict]:
        """Parse available models from JSON string."""
        import json
        try:
            return json.loads(self.available_models)
        except json.JSONDecodeError:
            return [
                {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "description": "Default model"}
            ]


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    
    Uses lru_cache to ensure settings are only loaded once
    and reused across all requests.
    """
    return Settings()


# Global settings instance
settings = get_settings()
