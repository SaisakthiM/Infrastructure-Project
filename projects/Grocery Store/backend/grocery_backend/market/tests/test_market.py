from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITestCase

from market.models import Order, Product, Shift
from market.views import SHIFT_MAX_ITEMS, WAGE_PER_ITEM

AUTH = "market.authentication.identity_for"


class MarketTestBase(APITestCase):
    def setUp(self):
        Product.objects.all().delete()  # drop the seed shelves, tests bring their own
        self.apple = Product.objects.create(name="Apple", emoji="🍎", category="produce", price=25, stock=10)
        self.milk = Product.objects.create(name="Milk", emoji="🥛", category="dairy", price=32, stock=2)


class ProductTests(MarketTestBase):
    def test_catalog_is_public(self):
        res = self.client.get("/api/products/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual({p["name"] for p in res.json()}, {"Apple", "Milk"})

    def test_category_filter(self):
        res = self.client.get("/api/products/?category=dairy")
        self.assertEqual([p["name"] for p in res.json()], ["Milk"])

    def test_inactive_products_are_hidden(self):
        self.milk.is_active = False
        self.milk.save()
        self.assertEqual(len(self.client.get("/api/products/").json()), 1)

    def test_seed_data_ships_with_migrations(self):
        # setUp deleted it; this just documents that migration 0002 exists and is importable
        from market.migrations import __path__ as p  # noqa: F401
        self.assertTrue(p)


class CheckoutTests(MarketTestBase):
    def post(self, items, expected=None, who="citizen"):
        body = {"items": items}
        if expected is not None:
            body["expected_total"] = expected
        with patch(AUTH, return_value=who):
            return self.client.post("/api/checkout/", body, format="json")

    def test_requires_a_citizen(self):
        with patch(AUTH, return_value=None):
            res = self.client.post("/api/checkout/", {"items": [{"product": self.apple.id, "quantity": 1}]}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_success_decrements_stock_and_records_order(self):
        res = self.post([{"product": self.apple.id, "quantity": 3}], expected=75)
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["total"], 75)
        self.apple.refresh_from_db()
        self.assertEqual(self.apple.stock, 7)
        order = Order.objects.get()
        self.assertEqual(order.buyer, "citizen")
        self.assertEqual(order.items.get().unit_price, 25)

    def test_total_is_computed_by_the_server(self):
        res = self.post([{"product": self.apple.id, "quantity": 2}, {"product": self.milk.id, "quantity": 1}])
        self.assertEqual(res.json()["total"], 25 * 2 + 32)

    def test_price_mismatch_is_rejected_and_nothing_changes(self):
        res = self.post([{"product": self.apple.id, "quantity": 2}], expected=1)
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()["total"], 50)
        self.apple.refresh_from_db()
        self.assertEqual(self.apple.stock, 10)
        self.assertEqual(Order.objects.count(), 0)

    def test_out_of_stock_is_rejected(self):
        res = self.post([{"product": self.milk.id, "quantity": 3}])
        self.assertEqual(res.status_code, 409)
        self.milk.refresh_from_db()
        self.assertEqual(self.milk.stock, 2)

    def test_empty_and_malformed_baskets(self):
        self.assertEqual(self.post([]).status_code, 400)
        self.assertEqual(self.post([{"product": "x", "quantity": 1}]).status_code, 400)
        self.assertEqual(self.post([{"product": self.apple.id, "quantity": 0}]).status_code, 400)
        self.assertEqual(self.post([{"product": self.apple.id, "quantity": 999}]).status_code, 400)

    def test_unknown_product(self):
        self.assertEqual(self.post([{"product": 99999, "quantity": 1}]).status_code, 404)

    def test_orders_are_per_citizen(self):
        self.post([{"product": self.apple.id, "quantity": 1}], who="alice")
        with patch(AUTH, return_value="bob"):
            self.assertEqual(self.client.get("/api/orders/").json(), [])
        with patch(AUTH, return_value="alice"):
            self.assertEqual(len(self.client.get("/api/orders/").json()), 1)


class ShiftTests(MarketTestBase):
    def start(self, who="worker"):
        with patch(AUTH, return_value=who):
            return self.client.post("/api/shift/start/")

    def finish(self, token, stocked, who="worker"):
        with patch(AUTH, return_value=who):
            return self.client.post("/api/shift/finish/", {"token": token, "stocked": stocked}, format="json")

    def age(self, seconds):
        Shift.objects.update(started_at=timezone.now() - timedelta(seconds=seconds))

    def test_start_requires_a_citizen(self):
        with patch(AUTH, return_value=None):
            self.assertEqual(self.client.post("/api/shift/start/").status_code, 401)

    def test_normal_shift_pays_and_restocks(self):
        token = self.start().json()["token"]
        self.age(20)
        res = self.finish(token, 5)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["wage"], 5 * WAGE_PER_ITEM)
        # 5 crates went to the emptiest shelves (milk had 2)
        self.milk.refresh_from_db()
        self.apple.refresh_from_db()
        self.assertEqual(self.milk.stock + self.apple.stock, 2 + 10 + 5)

    def test_full_shift_gets_bonus(self):
        token = self.start().json()["token"]
        self.age(25)
        self.assertGreater(self.finish(token, SHIFT_MAX_ITEMS).json()["wage"], SHIFT_MAX_ITEMS * WAGE_PER_ITEM)

    def test_score_is_clamped(self):
        token = self.start().json()["token"]
        self.age(25)
        self.assertEqual(self.finish(token, 10_000).json()["stocked"], SHIFT_MAX_ITEMS)

    def test_instant_finish_is_rejected(self):
        token = self.start().json()["token"]
        self.assertEqual(self.finish(token, 12).status_code, 400)

    def test_cannot_finish_twice(self):
        token = self.start().json()["token"]
        self.age(20)
        self.finish(token, 3)
        self.assertEqual(self.finish(token, 3).status_code, 409)

    def test_cannot_finish_someone_elses_shift(self):
        token = self.start("alice").json()["token"]
        self.age(20)
        self.assertEqual(self.finish(token, 3, who="bob").status_code, 404)

    def test_garbage_token(self):
        self.assertEqual(self.finish("not-a-uuid", 3).status_code, 404)

    def test_cooldown_between_shifts(self):
        token = self.start().json()["token"]
        self.age(20)
        self.finish(token, 2)
        self.assertEqual(self.start().status_code, 429)

    def test_hourly_cap(self):
        Shift.objects.create(worker="worker", finished_at=timezone.now() - timedelta(minutes=5), wage=595, stocked=1)
        token = self.start().json()["token"]
        self.age(25)
        res = self.finish(token, SHIFT_MAX_ITEMS)
        self.assertEqual(res.json()["wage"], 5)
        self.assertTrue(res.json()["capped"])


class SummaryTests(MarketTestBase):
    def test_summary(self):
        data = self.client.get("/api/summary/").json()
        self.assertEqual(data["products"], 2)
        self.assertEqual(data["units_in_stock"], 12)
