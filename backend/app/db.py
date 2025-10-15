from contextlib import contextmanager
from typing import Generator

from pydantic_settings import BaseSettings
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session


class Settings(BaseSettings):
    # Example: postgresql+psycopg://standuser:standpass@db:5432/standdb
    DATABASE_URL: str = "postgresql+psycopg://standuser:standpass@db:5432/standdb"


settings = Settings()


def get_engine() -> Engine:
    # Ensure failed DB connections time out quickly instead of hanging requests.
    return create_engine(
        settings.DATABASE_URL,
        future=True,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 5},
        pool_recycle=1800,
    )


class Base(DeclarativeBase):
    pass


SessionLocal = sessionmaker(bind=get_engine(), autoflush=False, autocommit=False, future=True)


@contextmanager
def db_connection() -> Generator:
    engine = get_engine()
    with engine.connect() as conn:
        yield conn


@contextmanager
def get_session() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> bool:
    try:
        with db_connection() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def init_db() -> None:
    # Import models here to ensure metadata is populated before create_all
    from . import models  # noqa: F401

    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    # Lightweight migration for newly added columns (PostgreSQL)
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE cars ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE"))
            conn.commit()
    except Exception:
        # Best-effort: if it fails, surface via API when used, but don't crash startup
        pass
