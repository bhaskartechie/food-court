"""
Application configuration — loaded from .env via pydantic-settings.

Local dev:  backend/.env          (localhost URLs)
Docker:     docker-compose.yml    (service-name URLs injected as env vars)
"""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All application settings. Values are read from environment / .env file."""

    # ── API ────────────────────────────────────────────────────────────────────
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_RELOAD: bool = True

    # ── Database ───────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/society_food"
    DB_ECHO: bool = False
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    # ── Security / JWT ─────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Password Hashing ───────────────────────────────────────────────────────
    PASSWORD_HASH_ROUNDS: int = 12

    # ── OTP Authentication & Rate Limiting ────────────────────────────────────
    OTP_EXPIRY_MINUTES: int = 5
    OTP_MAX_ATTEMPTS: int = 5
    OTP_LENGTH: int = 6
    OTP_RATE_LIMIT_REQUESTS: int = 3
    OTP_RATE_LIMIT_WINDOW_MINUTES: int = 15

    # ── Email (SMTP) ───────────────────────────────────────────────────────────
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SENDER_EMAIL: str = "noreply@societyfood.com"
    SENDER_NAME: str = "Society Food Platform"

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL: int = 3600

    # ── Logging ───────────────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "development"

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8080"

    # ── Direct P2PM UPI & SaaS Pass Maintenance ───────────────────────────────
    PLATFORM_UPI_VPA: str = "societyfood@upi"
    PLATFORM_UPI_NAME: str = "Society Food Platform"
    FREE_ORDERS_QUOTA: int = 50
    MAINTENANCE_FEE_PER_ORDER: float = 5.0
    MAINTENANCE_GRACE_LIMIT: float = -25.0  # Allows up to 5 orders in grace before disabling availability

    # ── Razorpay Payment Gateway (Legacy / Fallback) ───────────────────────────
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""
    # Platform commission percentage deducted from each sale before crediting seller
    PLATFORM_FEE_PERCENT: float = 5.0

    # ── Feature Flags ─────────────────────────────────────────────────────────
    ENABLE_OTP_EMAIL: bool = True  # True → send OTP via SMTP
    ENABLE_OTP_WHATSAPP: bool = False
    ENABLE_WEBSOCKET: bool = False

    # ── Monitoring ────────────────────────────────────────────────────────────
    SENTRY_DSN: str = ""

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_CALLS: int = 100
    RATE_LIMIT_PERIOD: int = 60

    model_config = {
        "env_file": (".env", "backend/.env", "../.env"),
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }



@lru_cache()
def get_settings() -> Settings:
    """Return cached Settings instance."""
    return Settings()


settings = get_settings()
