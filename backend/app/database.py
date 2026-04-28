from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool
from app.config import settings

_is_sqlite = "sqlite" in settings.DATABASE_URL

_db_url = settings.DATABASE_URL
if not _is_sqlite and _db_url.startswith("postgresql://"):
    _db_url = _db_url.replace("postgresql://", "postgresql+psycopg://", 1)

_connect_args = {} if _is_sqlite else {"sslmode": "require", "prepare_threshold": None}

engine = create_engine(
    _db_url,
    echo=settings.DEBUG,
    poolclass=NullPool,
    connect_args=_connect_args,
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base for models
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database with all tables"""
    Base.metadata.create_all(bind=engine)
