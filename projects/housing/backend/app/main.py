"""Housing district API — plots, buying, upgrading, selling and rent income."""
import sqlite3
from contextlib import asynccontextmanager, contextmanager

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import db, rules
from .identity import current_citizen


@asynccontextmanager
async def lifespan(_app: FastAPI):
    conn = db.connect()
    db.init(conn)
    conn.close()
    yield


app = FastAPI(title="Mini City Housing", lifespan=lifespan)


def get_conn():
    conn = db.connect()
    db.init(conn)  # cheap and idempotent: also makes tests with a fresh DB path just work
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def write_tx(conn: sqlite3.Connection):
    """One writer at a time; the whole check-then-write sequence is atomic."""
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise


def plot_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "x": row["x"],
        "y": row["y"],
        "tier": row["tier"],
        "owner": row["owner"],
    }


def paid_count(conn: sqlite3.Connection, owner: str) -> int:
    return conn.execute(
        "SELECT COUNT(*) FROM plots WHERE owner = ? AND tier != ?", (owner, rules.CHECKPOINT)
    ).fetchone()[0]


def get_plot(conn: sqlite3.Connection, plot_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM plots WHERE id = ?", (plot_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="No such plot.")
    return row


class BuyBody(BaseModel):
    tier: str
    price: int = Field(description="what the browser charged; must equal the catalogue price")


class UpgradeBody(BaseModel):
    tier: str
    cost: int = Field(description="the difference the browser charged")


@app.get("/api/catalog/")
def catalog():
    return {
        "tiers": [{"id": k, **v} for k, v in rules.TIERS.items()],
        "maxPaidProperties": rules.MAX_PAID_PROPERTIES,
        "sellBackPercent": rules.SELL_BACK_PERCENT,
        "maxAccrualHours": rules.MAX_ACCRUAL_HOURS,
    }


@app.get("/api/plots/")
def plots(conn: sqlite3.Connection = Depends(get_conn)):
    rows = conn.execute("SELECT * FROM plots ORDER BY id").fetchall()
    return {"width": db.GRID_W, "height": db.GRID_H, "plots": [plot_dict(r) for r in rows]}


@app.get("/api/stats/")
def stats(conn: sqlite3.Connection = Depends(get_conn)):
    total = conn.execute("SELECT COUNT(*) FROM plots").fetchone()[0]
    owned = conn.execute("SELECT COUNT(*) FROM plots WHERE owner IS NOT NULL").fetchone()[0]
    residents = conn.execute("SELECT COUNT(DISTINCT owner) FROM plots WHERE owner IS NOT NULL").fetchone()[0]
    return {"plots": total, "occupied": owned, "free": total - owned, "residents": residents}


@app.get("/api/me/")
def me(citizen: str = Depends(current_citizen), conn: sqlite3.Connection = Depends(get_conn)):
    now = db.now()
    rows = conn.execute("SELECT * FROM plots WHERE owner = ? ORDER BY id", (citizen,)).fetchall()
    mine = []
    claimable = 0
    for r in rows:
        rent = rules.accrued_rent(r["tier"], r["last_collected"] or now, now)
        claimable += rent
        mine.append({**plot_dict(r), "accrued": rent, "sellValue": rules.sell_value(r["tier"])})
    return {
        "user": citizen,
        "properties": mine,
        "hasCheckpoint": any(p["tier"] == rules.CHECKPOINT for p in mine),
        "paidCount": sum(1 for p in mine if p["tier"] != rules.CHECKPOINT),
        "claimable": claimable,
    }


@app.post("/api/plots/{plot_id}/checkpoint/")
def claim_checkpoint(plot_id: int, citizen: str = Depends(current_citizen), conn: sqlite3.Connection = Depends(get_conn)):
    """Every citizen gets one free starter shelter, so nobody is homeless in Mini City."""
    with write_tx(conn):
        plot = get_plot(conn, plot_id)
        if plot["owner"] is not None:
            raise HTTPException(status_code=409, detail="That plot is already taken.")
        has = conn.execute(
            "SELECT 1 FROM plots WHERE owner = ? AND tier = ?", (citizen, rules.CHECKPOINT)
        ).fetchone()
        if has:
            raise HTTPException(status_code=409, detail="You already have a checkpoint shelter.")
        conn.execute(
            "UPDATE plots SET owner = ?, tier = ?, last_collected = ?, bought_at = ? WHERE id = ?",
            (citizen, rules.CHECKPOINT, db.now(), db.now(), plot_id),
        )
    return {"ok": True, "plot": plot_id, "tier": rules.CHECKPOINT}


@app.post("/api/plots/{plot_id}/buy/", status_code=201)
def buy(plot_id: int, body: BuyBody, citizen: str = Depends(current_citizen), conn: sqlite3.Connection = Depends(get_conn)):
    """The browser has already charged `price` to the bank; if we refuse here it refunds itself."""
    if body.tier not in rules.PAID_TIERS:
        raise HTTPException(status_code=400, detail="Unknown property type.")
    price = rules.TIERS[body.tier]["price"]
    if body.price != price:
        raise HTTPException(status_code=409, detail=f"The price is now ₹{price}.")
    with write_tx(conn):
        plot = get_plot(conn, plot_id)
        if plot["owner"] is not None:
            raise HTTPException(status_code=409, detail="That plot was just taken.")
        if paid_count(conn, citizen) >= rules.MAX_PAID_PROPERTIES:
            raise HTTPException(status_code=409, detail=f"You can own at most {rules.MAX_PAID_PROPERTIES} properties.")
        conn.execute(
            "UPDATE plots SET owner = ?, tier = ?, last_collected = ?, bought_at = ? WHERE id = ?",
            (citizen, body.tier, db.now(), db.now(), plot_id),
        )
    return {"ok": True, "plot": plot_id, "tier": body.tier, "price": price}


@app.post("/api/plots/{plot_id}/upgrade/")
def upgrade(plot_id: int, body: UpgradeBody, citizen: str = Depends(current_citizen), conn: sqlite3.Connection = Depends(get_conn)):
    if body.tier not in rules.PAID_TIERS:
        raise HTTPException(status_code=400, detail="Unknown property type.")
    with write_tx(conn):
        plot = get_plot(conn, plot_id)
        if plot["owner"] != citizen:
            raise HTTPException(status_code=403, detail="That is not your property.")
        cost = rules.upgrade_cost(plot["tier"], body.tier)
        if cost <= 0:
            raise HTTPException(status_code=409, detail="Pick a better property type to upgrade to.")
        if body.cost != cost:
            raise HTTPException(status_code=409, detail=f"The upgrade now costs ₹{cost}.")
        if plot["tier"] == rules.CHECKPOINT and paid_count(conn, citizen) >= rules.MAX_PAID_PROPERTIES:
            raise HTTPException(status_code=409, detail=f"You can own at most {rules.MAX_PAID_PROPERTIES} properties.")
        # rent earned so far stays collectable: keep last_collected as is
        conn.execute("UPDATE plots SET tier = ? WHERE id = ?", (body.tier, plot_id))
    return {"ok": True, "plot": plot_id, "tier": body.tier, "cost": cost}


@app.post("/api/plots/{plot_id}/sell/")
def sell(plot_id: int, citizen: str = Depends(current_citizen), conn: sqlite3.Connection = Depends(get_conn)):
    """Returns `refund`; the browser credits it to the bank. Checkpoint shelters are not for sale."""
    with write_tx(conn):
        plot = get_plot(conn, plot_id)
        if plot["owner"] != citizen:
            raise HTTPException(status_code=403, detail="That is not your property.")
        if plot["tier"] == rules.CHECKPOINT:
            raise HTTPException(status_code=409, detail="Checkpoint shelters cannot be sold.")
        now = db.now()
        pending = rules.accrued_rent(plot["tier"], plot["last_collected"] or now, now)
        refund = rules.sell_value(plot["tier"]) + pending  # unclaimed rent is paid out with the sale
        conn.execute(
            "UPDATE plots SET owner = NULL, tier = NULL, last_collected = NULL, bought_at = NULL WHERE id = ?",
            (plot_id,),
        )
    return {"ok": True, "plot": plot_id, "refund": refund}


@app.post("/api/collect/")
def collect(citizen: str = Depends(current_citizen), conn: sqlite3.Connection = Depends(get_conn)):
    """Pays out all accrued rent (max 24 h per property) and restarts the clock."""
    total = 0
    with write_tx(conn):
        now = db.now()
        rows = conn.execute("SELECT * FROM plots WHERE owner = ?", (citizen,)).fetchall()
        for r in rows:
            total += rules.accrued_rent(r["tier"], r["last_collected"] or now, now)
            conn.execute("UPDATE plots SET last_collected = ? WHERE id = ?", (now, r["id"]))
    return {"amount": total}
