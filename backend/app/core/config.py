from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import cached_property


class Settings(BaseSettings):
    # ===== ENV =====
    environment: str = "local"  # local | railway

    # ===== SECRET =====
    secret_key: str

    # ===== DATABASE =====
    database_url_local: str | None = None
    database_url_railway: str | None = None

    # ===== AUTH =====
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    # ===== CORS =====
    allowed_origins: str = "http://localhost:5173,http://localhost:5174,http://localhost:3000"

    # ===== STATIC =====
    public_base_url: str = ""

    # ===== REDIS =====
    redis_url: str = "redis://localhost:6379"

    # ===== OPTIONAL =====
    railway_database_url: str | None = None

    # =========================
    # 🎯 AUTO CHOOSE DATABASE
    # =========================
    @cached_property
    def database_url(self) -> str:
        if self.environment == "local":
            if not self.database_url_local:
                raise ValueError("Missing DATABASE_URL_LOCAL")
            return self._fix_async_driver(self.database_url_local)

        elif self.environment == "railway":
            if not self.database_url_railway:
                raise ValueError("Missing DATABASE_URL_RAILWAY")
            return self._fix_async_driver(self.database_url_railway)

        else:
            raise ValueError(f"Invalid ENVIRONMENT: {self.environment}")

    # =========================
    # 🔧 FIX DRIVER
    # =========================
    @staticmethod
    def _fix_async_driver(v: str) -> str:
        if v.startswith("postgresql://") and "+asyncpg" not in v:
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        if v.startswith("postgres://") and "+asyncpg" not in v:
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        return v

    # =========================
    # 🔍 DEBUG PRINT (optional)
    # =========================
    def print_debug(self):
        print("ENVIRONMENT:", self.environment)
        print("DATABASE_URL:", self.database_url)

    class Config:
        env_file = ".env"


settings = Settings()
