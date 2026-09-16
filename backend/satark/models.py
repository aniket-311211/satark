from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class WatchlistEntity(Base):
    __tablename__ = "watchlist_entities"

    id: Mapped[str] = mapped_column(String(160), primary_key=True)
    source: Mapped[str] = mapped_column(String(64), index=True)
    schema: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(Text)
    aliases: Mapped[list] = mapped_column(JSON, default=list)
    birth_date: Mapped[str] = mapped_column(Text, default="")
    countries: Mapped[str] = mapped_column(Text, default="")
    sanctions: Mapped[str] = mapped_column(Text, default="")
    program: Mapped[str] = mapped_column(Text, default="")
    dataset: Mapped[str] = mapped_column(Text, default="")
    first_seen: Mapped[str] = mapped_column(String(64), default="")
    last_change: Mapped[str] = mapped_column(String(64), default="")
    row_hash: Mapped[str] = mapped_column(String(40))
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class IngestRun(Base):
    __tablename__ = "ingest_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(64))
    mode: Mapped[str] = mapped_column(String(16))
    total: Mapped[int] = mapped_column(Integer, default=0)
    added: Mapped[int] = mapped_column(Integer, default=0)
    changed: Mapped[int] = mapped_column(Integer, default=0)
    removed: Mapped[int] = mapped_column(Integer, default=0)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(256), index=True)
    kind: Mapped[str] = mapped_column(String(16), default="person")
    birth_date: Mapped[str] = mapped_column(String(32), default="")
    country: Mapped[str] = mapped_column(String(8), default="in")
    segment: Mapped[str] = mapped_column(String(32), default="retail")
    synthetic: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_screened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    entity_id: Mapped[str] = mapped_column(String(160), index=True)
    score: Mapped[float] = mapped_column(Float)
    band: Mapped[str] = mapped_column(String(16))
    matched_name: Mapped[str] = mapped_column(Text)
    reasons: Mapped[list] = mapped_column(JSON, default=list)
    components: Mapped[dict] = mapped_column(JSON, default=dict)
    trigger: Mapped[str] = mapped_column(String(24))
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
    decided_by: Mapped[str] = mapped_column(String(64), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MediaEvent(Base):
    __tablename__ = "media_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subject: Mapped[str] = mapped_column(String(256), index=True)
    category: Mapped[str] = mapped_column(String(32))
    headline: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text, default="")
    quote: Mapped[str] = mapped_column(Text, default="")
    url: Mapped[str] = mapped_column(Text)
    publisher: Mapped[str] = mapped_column(String(256), default="")
    published_at: Mapped[str] = mapped_column(String(64), default="")
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    checks: Mapped[dict] = mapped_column(JSON, default=dict)
    extractor: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(48), index=True)
    target: Mapped[str] = mapped_column(String(256), default="")
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


def make_session_factory(database_url: str) -> sessionmaker:
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    engine = create_engine(database_url, connect_args=connect_args, pool_pre_ping=True)
    Base.metadata.create_all(engine)
    return sessionmaker(engine, expire_on_commit=False)
