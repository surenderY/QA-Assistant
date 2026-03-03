from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    app_env: str = "development"
    app_name: str = "TestGen AI"
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60
    debug: bool = True

    # Database
    database_url: str = "postgresql+asyncpg://testgen:testgen@localhost:5432/testgen_db"
    database_url_sync: str = "postgresql://testgen:testgen@localhost:5432/testgen_db"

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    # Anthropic
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-4-6"

    # JIRA
    jira_server_url: str = ""
    jira_email: str = ""
    jira_api_token: str = ""

    # Git
    git_repo_path: str = "/app/test_repo"
    git_remote_url: str = ""
    git_username: str = ""
    git_token: str = ""
    git_author_name: str = "TestGen Bot"
    git_author_email: str = "testgen@company.com"

    # CORS
    allowed_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
