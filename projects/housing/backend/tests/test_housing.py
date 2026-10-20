import pytest
from fastapi.testclient import TestClient

from app import db, rules
from app.identity import current_citizen
from app.main import app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("HOUSING_DB", str(tmp_path / "housing-test.db"))
    who = {"user": "alice"}
    app.dependency_overrides[current_citizen] = lambda: who["user"]
    with TestClient(app) as c:
        c.who = who
        yield c
    app.dependency_overrides.clear()


def as_user(client, name):
    client.who["user"] = name


def set_clock(plot_id, hours_ago):
    conn = db.connect()
    conn.execute("UPDATE plots SET last_collected = ? WHERE id = ?", (db.now() - hours_ago * 3600, plot_id))
    conn.close()


def buy(client, plot, tier):
    return client.post(f"/api/plots/{plot}/buy/", json={"tier": tier, "price": rules.TIERS[tier]["price"]})


class TestPublic:
    def test_catalog(self, client):
        data = client.get("/api/catalog/").json()
        ids = [t["id"] for t in data["tiers"]]
        assert ids == ["checkpoint", "cottage", "apartment", "villa", "tower"]
        assert data["sellBackPercent"] == 70

    def test_the_map_has_a_full_grid_of_free_plots(self, client):
        data = client.get("/api/plots/").json()
        assert (data["width"], data["height"]) == (6, 4)
        assert len(data["plots"]) == 24
        assert all(p["owner"] is None for p in data["plots"])

    def test_stats(self, client):
        buy(client, 1, "cottage")
        stats = client.get("/api/stats/").json()
        assert stats == {"plots": 24, "occupied": 1, "free": 23, "residents": 1}


class TestAuth:
    def test_private_endpoints_need_a_citizen(self, client):
        app.dependency_overrides.pop(current_citizen)  # no override: real check, no headers sent
        assert client.get("/api/me/").status_code == 401
        assert client.post("/api/collect/").status_code == 401
        assert client.post("/api/plots/1/buy/", json={"tier": "cottage", "price": 800}).status_code == 401


class TestCheckpoint:
    def test_everyone_gets_one_free_shelter(self, client):
        assert client.post("/api/plots/3/checkpoint/").status_code == 200
        me = client.get("/api/me/").json()
        assert me["hasCheckpoint"] is True
        assert me["properties"][0]["tier"] == "checkpoint"

    def test_only_one_per_citizen(self, client):
        client.post("/api/plots/3/checkpoint/")
        assert client.post("/api/plots/4/checkpoint/").status_code == 409

    def test_cannot_take_an_occupied_plot(self, client):
        client.post("/api/plots/3/checkpoint/")
        as_user(client, "bob")
        assert client.post("/api/plots/3/checkpoint/").status_code == 409

    def test_unknown_plot(self, client):
        assert client.post("/api/plots/999/checkpoint/").status_code == 404


class TestBuy:
    def test_buying_a_free_plot(self, client):
        res = buy(client, 5, "villa")
        assert res.status_code == 201
        plots = {p["id"]: p for p in client.get("/api/plots/").json()["plots"]}
        assert plots[5]["owner"] == "alice" and plots[5]["tier"] == "villa"

    def test_price_must_match_the_catalogue(self, client):
        res = client.post("/api/plots/5/buy/", json={"tier": "villa", "price": 1})
        assert res.status_code == 409
        assert "6000" in res.json()["detail"]
        assert client.get("/api/stats/").json()["occupied"] == 0

    def test_a_taken_plot_is_refused(self, client):
        buy(client, 5, "cottage")
        as_user(client, "bob")
        assert buy(client, 5, "tower").status_code == 409

    def test_checkpoint_and_unknown_tiers_are_not_for_sale(self, client):
        assert client.post("/api/plots/5/buy/", json={"tier": "checkpoint", "price": 0}).status_code == 400
        assert client.post("/api/plots/5/buy/", json={"tier": "castle", "price": 1}).status_code == 400

    def test_property_limit(self, client):
        for plot in range(1, 6):
            assert buy(client, plot, "cottage").status_code == 201
        res = buy(client, 6, "cottage")
        assert res.status_code == 409
        assert "at most 5" in res.json()["detail"]

    def test_checkpoint_does_not_count_toward_the_limit(self, client):
        client.post("/api/plots/20/checkpoint/")
        for plot in range(1, 6):
            assert buy(client, plot, "cottage").status_code == 201


class TestUpgrade:
    def test_owner_can_upgrade_by_paying_the_difference(self, client):
        buy(client, 1, "cottage")
        res = client.post("/api/plots/1/upgrade/", json={"tier": "villa", "cost": 6000 - 800})
        assert res.status_code == 200
        assert res.json()["cost"] == 5200

    def test_checkpoint_can_be_upgraded(self, client):
        client.post("/api/plots/1/checkpoint/")
        res = client.post("/api/plots/1/upgrade/", json={"tier": "cottage", "cost": 800})
        assert res.status_code == 200

    def test_not_your_property(self, client):
        buy(client, 1, "cottage")
        as_user(client, "bob")
        assert client.post("/api/plots/1/upgrade/", json={"tier": "villa", "cost": 5200}).status_code == 403

    def test_cost_must_match(self, client):
        buy(client, 1, "cottage")
        assert client.post("/api/plots/1/upgrade/", json={"tier": "villa", "cost": 10}).status_code == 409

    def test_no_downgrades(self, client):
        buy(client, 1, "villa")
        assert client.post("/api/plots/1/upgrade/", json={"tier": "cottage", "cost": -5200}).status_code == 409


class TestSell:
    def test_selling_returns_seventy_percent_and_frees_the_plot(self, client):
        buy(client, 1, "apartment")
        res = client.post("/api/plots/1/sell/")
        assert res.status_code == 200
        assert res.json()["refund"] == 2500 * 70 // 100
        plots = {p["id"]: p for p in client.get("/api/plots/").json()["plots"]}
        assert plots[1]["owner"] is None and plots[1]["tier"] is None

    def test_unclaimed_rent_is_paid_with_the_sale(self, client):
        buy(client, 1, "cottage")
        set_clock(1, hours_ago=3)
        refund = client.post("/api/plots/1/sell/").json()["refund"]
        assert refund == 800 * 70 // 100 + 3 * 20

    def test_checkpoint_cannot_be_sold(self, client):
        client.post("/api/plots/1/checkpoint/")
        assert client.post("/api/plots/1/sell/").status_code == 409

    def test_only_the_owner_can_sell(self, client):
        buy(client, 1, "cottage")
        as_user(client, "bob")
        assert client.post("/api/plots/1/sell/").status_code == 403


class TestRent:
    def test_collect_pays_hours_times_rent_then_resets(self, client):
        buy(client, 1, "villa")
        set_clock(1, hours_ago=2)
        first = client.post("/api/collect/").json()["amount"]
        assert first == 2 * 160 or first == 2 * 160 + 0  # whole rupees, clock drift is far below one rupee here
        assert client.post("/api/collect/").json()["amount"] == 0

    def test_rent_stops_accruing_after_a_day(self, client):
        buy(client, 1, "tower")
        set_clock(1, hours_ago=100)
        assert client.post("/api/collect/").json()["amount"] == 24 * 420

    def test_checkpoint_earns_nothing(self, client):
        client.post("/api/plots/1/checkpoint/")
        set_clock(1, hours_ago=10)
        assert client.post("/api/collect/").json()["amount"] == 0

    def test_me_previews_claimable_rent(self, client):
        buy(client, 1, "cottage")
        buy(client, 2, "apartment")
        set_clock(1, hours_ago=5)
        set_clock(2, hours_ago=1)
        me = client.get("/api/me/").json()
        assert me["claimable"] == 5 * 20 + 1 * 60
        assert me["paidCount"] == 2

    def test_other_citizens_rent_is_untouched(self, client):
        buy(client, 1, "cottage")
        set_clock(1, hours_ago=4)
        as_user(client, "bob")
        assert client.post("/api/collect/").json()["amount"] == 0
        as_user(client, "alice")
        assert client.post("/api/collect/").json()["amount"] == 4 * 20


class TestRules:
    def test_accrual_helper(self):
        assert rules.accrued_rent("cottage", 0, 3600 * 2) == 40
        assert rules.accrued_rent("cottage", 0, 3600 * 1000) == 20 * 24
        assert rules.accrued_rent("cottage", 100, 50) == 0  # clock going backwards never pays
        assert rules.upgrade_cost("cottage", "tower") == 14200
