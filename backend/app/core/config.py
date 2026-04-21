from pydantic_settings import BaseSettings
from pydantic import field_validator

class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    environment: str = "development"
    # Comma-separated list of allowed CORS origins
    allowed_origins: str = "http://localhost:5173,http://localhost:5174,http://localhost:3000"
    # Public base URL for avatar URLs — set this on server (e.g. https://api.example.com)
    public_base_url: str = ""
    # Redis URL — inside docker-compose use service name; outside use localhost
    redis_url: str = "redis://localhost:6380"
    # Railway DB URL for sync (only needed in api-local environment)
    railway_database_url: str | None = None

    @field_validator("database_url")
    @classmethod
    def fix_async_driver(cls, v: str) -> str:
        # Railway provides postgresql:// but asyncpg needs postgresql+asyncpg://
        if v.startswith("postgresql://") and "+asyncpg" not in v:
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        if v.startswith("postgres://") and "+asyncpg" not in v:
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        return v

    class Config:
        env_file = ".env"

settings = Settings()
