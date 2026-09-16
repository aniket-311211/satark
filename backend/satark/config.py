from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SATARK_", env_file=(ROOT / ".env", ".env"), extra="ignore")

    database_url: str = f"sqlite:///{ROOT / 'satark.db'}"
    redis_url: str = ""
    data_dir: Path = ROOT / "data"
    reports_dir: Path = ROOT / "reports"
    alert_threshold: float = 80.0
    min_score: float = 70.0
    anthropic_api_key: str = Field(default="", validation_alias=AliasChoices("SATARK_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY"))
    llm_model: str = "claude-haiku-4-5"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    media_max_items: int = 12


@lru_cache
def get_settings() -> Settings:
    return Settings()
