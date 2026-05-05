import logging
from pathlib import Path
from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/estoque_db"

    # Security — SECRET_KEY deve estar no .env; sem valor padrão seguro aqui
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    COOKIE_SECURE: bool = False  # True em produção HTTPS

    # CORS — origens separadas por vírgula no .env
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"

    # API
    DEBUG: bool = False
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/estoque.log"

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

settings = Settings()

# Configure logging — file handler only outside serverless environments
_handlers = [logging.StreamHandler()]
if not os.environ.get('VERCEL'):
    log_path = Path(settings.LOG_FILE)
    log_path.parent.mkdir(exist_ok=True)
    _handlers.append(logging.FileHandler(settings.LOG_FILE))

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=_handlers,
)

logger = logging.getLogger(__name__)
