import os
import sqlite3
import time

GRID_W = 6
GRID_H = 4


def db_path() -> str:
    return os.environ.get("HOUSING_DB", "housing.db")


def connect() -> sqlite3.Connection:
    path = db_path()
    if path != ":memory:":
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    conn = sqlite3.connect(path, timeout=10, isolation_level=None)  # autocommit; we open transactions ourselves
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS plots (
            id             INTEGER PRIMARY KEY,
            x              INTEGER NOT NULL,
            y              INTEGER NOT NULL,
            tier           TEXT,
            owner          TEXT,
            last_collected REAL,
            bought_at      REAL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_plots_owner ON plots(owner)")
    count = conn.execute("SELECT COUNT(*) FROM plots").fetchone()[0]
    if count == 0:
        conn.execute("BEGIN")
        for i in range(GRID_W * GRID_H):
            conn.execute("INSERT INTO plots (id, x, y) VALUES (?, ?, ?)", (i + 1, i % GRID_W, i // GRID_W))
        conn.execute("COMMIT")


def now() -> float:
    return time.time()
