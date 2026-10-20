from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, F, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Order, OrderItem, Product, Shift

MAX_LINE_QTY = 20
SHIFT_SECONDS = 30
SHIFT_MIN_SECONDS = 8          # nobody stocks 12 crates in two seconds
SHIFT_MAX_ITEMS = 12
WAGE_PER_ITEM = 8
FULL_SHIFT_BONUS = 20
SHIFT_COOLDOWN_SECONDS = 20
HOURLY_WAGE_CAP = 600


def _product(p):
    return {"id": p.id, "name": p.name, "emoji": p.emoji, "category": p.category, "price": p.price, "stock": p.stock}


class ProductListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = Product.objects.filter(is_active=True)
        category = request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        return Response([_product(p) for p in qs])


class CheckoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        lines = request.data.get("items")
        expected = request.data.get("expected_total")
        if not isinstance(lines, list) or not lines or len(lines) > 40:
            return Response({"error": "Your basket is empty."}, status=status.HTTP_400_BAD_REQUEST)

        wanted = {}
        for line in lines:
            try:
                pid = int(line["product"])
                qty = int(line["quantity"])
            except (KeyError, TypeError, ValueError):
                return Response({"error": "Malformed basket."}, status=status.HTTP_400_BAD_REQUEST)
            if qty < 1 or qty > MAX_LINE_QTY:
                return Response({"error": f"Quantity must be between 1 and {MAX_LINE_QTY}."}, status=status.HTTP_400_BAD_REQUEST)
            wanted[pid] = wanted.get(pid, 0) + qty

        with transaction.atomic():
            products = {p.id: p for p in Product.objects.select_for_update().filter(id__in=wanted, is_active=True)}
            if len(products) != len(wanted):
                return Response({"error": "One of those products is no longer sold."}, status=status.HTTP_404_NOT_FOUND)
            total = 0
            for pid, qty in wanted.items():
                p = products[pid]
                if p.stock < qty:
                    return Response({"error": f"Only {p.stock} × {p.name} left.", "product": pid}, status=status.HTTP_409_CONFLICT)
                total += p.price * qty
            if expected is not None and int(expected) != total:
                return Response({"error": "Prices changed — please review your basket.", "total": total}, status=status.HTTP_409_CONFLICT)

            order = Order.objects.create(buyer=request.user.username, total=total)
            for pid, qty in wanted.items():
                p = products[pid]
                OrderItem.objects.create(order=order, product=p, name=p.name, unit_price=p.price, quantity=qty)
                Product.objects.filter(pk=pid).update(stock=F("stock") - qty)

        return Response({"order": order.id, "total": total}, status=status.HTTP_201_CREATED)


class OrderListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = Order.objects.filter(buyer=request.user.username).prefetch_related("items")[:20]
        return Response([
            {
                "id": o.id,
                "total": o.total,
                "created_at": o.created_at.isoformat(),
                "items": [{"name": i.name, "quantity": i.quantity, "unit_price": i.unit_price} for i in o.items.all()],
            }
            for o in orders
        ])


class ShiftStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        now = timezone.now()
        last = Shift.objects.filter(worker=request.user.username, finished_at__isnull=False).order_by("-finished_at").first()
        if last and (now - last.finished_at).total_seconds() < SHIFT_COOLDOWN_SECONDS:
            wait = SHIFT_COOLDOWN_SECONDS - int((now - last.finished_at).total_seconds())
            return Response({"error": f"Take a breather — next shift in {wait}s."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        # an abandoned, unfinished shift is simply replaced
        Shift.objects.filter(worker=request.user.username, finished_at__isnull=True).delete()
        shift = Shift.objects.create(worker=request.user.username)
        return Response({
            "token": str(shift.token),
            "seconds": SHIFT_SECONDS,
            "max_items": SHIFT_MAX_ITEMS,
            "wage_per_item": WAGE_PER_ITEM,
            "bonus": FULL_SHIFT_BONUS,
        }, status=status.HTTP_201_CREATED)


class ShiftFinishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get("token")
        try:
            stocked = int(request.data.get("stocked", 0))
        except (TypeError, ValueError):
            return Response({"error": "Bad score."}, status=status.HTTP_400_BAD_REQUEST)
        stocked = max(0, min(stocked, SHIFT_MAX_ITEMS))

        with transaction.atomic():
            try:
                shift = Shift.objects.select_for_update().get(token=token, worker=request.user.username)
            except (Shift.DoesNotExist, ValidationError, ValueError):
                return Response({"error": "No such shift."}, status=status.HTTP_404_NOT_FOUND)
            if shift.finished_at:
                return Response({"error": "That shift is already over."}, status=status.HTTP_409_CONFLICT)

            now = timezone.now()
            elapsed = (now - shift.started_at).total_seconds()
            if elapsed < SHIFT_MIN_SECONDS:
                return Response({"error": "That was suspiciously fast."}, status=status.HTTP_400_BAD_REQUEST)
            if elapsed > SHIFT_SECONDS + 20:
                stocked = 0  # walked off the job

            earned_last_hour = (
                Shift.objects.filter(worker=request.user.username, finished_at__gte=now - timedelta(hours=1))
                .aggregate(total=Sum("wage"))["total"] or 0
            )
            wage = stocked * WAGE_PER_ITEM + (FULL_SHIFT_BONUS if stocked == SHIFT_MAX_ITEMS else 0)
            wage = max(0, min(wage, HOURLY_WAGE_CAP - earned_last_hour))

            shift.finished_at = now
            shift.stocked = stocked
            shift.wage = wage
            shift.save(update_fields=["finished_at", "stocked", "wage"])

            # the work is real: stocked crates land on the emptiest shelves
            for _ in range(stocked):
                emptiest = Product.objects.select_for_update().filter(is_active=True).order_by("stock", "id").first()
                if emptiest:
                    Product.objects.filter(pk=emptiest.pk).update(stock=F("stock") + 1)

        return Response({"wage": wage, "stocked": stocked, "capped": wage < stocked * WAGE_PER_ITEM})


class SummaryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        top = (
            OrderItem.objects.values("name").annotate(sold=Sum("quantity")).order_by("-sold")[:5]
        )
        return Response({
            "products": Product.objects.filter(is_active=True).count(),
            "units_in_stock": Product.objects.filter(is_active=True).aggregate(n=Sum("stock"))["n"] or 0,
            "orders": Order.objects.aggregate(n=Count("id"))["n"],
            "top": list(top),
        })
