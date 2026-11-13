import os
from pathlib import Path
from sqlalchemy import create_engine, String, Float, Integer, JSON, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

ROOT = Path(__file__).resolve().parents[1]
(ROOT / 'data').mkdir(exist_ok=True)
# STOCKLENS_DATA=real (default) uses market data imported by `python -m backend.market_data`;
# STOCKLENS_DATA=demo uses the deterministic fictional fixtures in seed.py (offline, used by tests).
DATA_MODE = os.getenv('STOCKLENS_DATA', 'real').strip().lower()
if DATA_MODE not in ('real', 'demo'):
    raise RuntimeError("STOCKLENS_DATA must be 'real' or 'demo'")
_DB_FILE = 'stocklens-real.db' if DATA_MODE == 'real' else 'stocklens.db'
DATABASE_URL = os.getenv('STOCKLENS_DATABASE_URL', f"sqlite:///{ROOT / 'data' / _DB_FILE}")
engine = create_engine(DATABASE_URL, connect_args={'check_same_thread': False})
SessionLocal = sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class Stock(Base):
    __tablename__ = 'stocks'
    symbol: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    sector: Mapped[str] = mapped_column(String)
    price: Mapped[float] = mapped_column(Float)
    history: Mapped[list] = mapped_column(JSON)
    financials: Mapped[dict] = mapped_column(JSON)

class Holding(Base):
    __tablename__ = 'holdings'
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    symbol: Mapped[str] = mapped_column(ForeignKey('stocks.symbol'), unique=True)
    quantity: Mapped[float] = mapped_column(Float)
    purchase_price: Mapped[float] = mapped_column(Float)

class Article(Base):
    __tablename__ = 'articles'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    symbols: Mapped[list] = mapped_column(JSON)
    headline: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(String)
    sentiment: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String)
    published_at: Mapped[str] = mapped_column(String)
    takeaway: Mapped[str] = mapped_column(String)
    publisher: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    url: Mapped[str | None] = mapped_column(String, nullable=True, default=None)

class Report(Base):
    __tablename__ = 'reports'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    symbol: Mapped[str] = mapped_column(ForeignKey('stocks.symbol'))
    analyst: Mapped[str] = mapped_column(String)
    recommendation: Mapped[str] = mapped_column(String)
    target: Mapped[float] = mapped_column(Float)
    horizon_months: Mapped[int] = mapped_column(Integer, default=12)
    thesis: Mapped[str] = mapped_column(String)
    risks: Mapped[list] = mapped_column(JSON)
    published_at: Mapped[str] = mapped_column(String)

def migrate(bind=engine):
    """create_all() never alters existing tables: add columns introduced after a database was created."""
    from sqlalchemy import inspect, text
    Base.metadata.create_all(bind)
    cols = {c['name'] for c in inspect(bind).get_columns('articles')}
    with bind.begin() as conn:
        for name in ('publisher', 'url'):
            if name not in cols:
                conn.execute(text(f'ALTER TABLE articles ADD COLUMN {name} VARCHAR'))

def get_db():
    with SessionLocal() as db:
        yield db
