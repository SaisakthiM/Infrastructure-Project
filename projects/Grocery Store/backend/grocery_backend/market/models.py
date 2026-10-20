import uuid

from django.db import models


class Product(models.Model):
    name = models.CharField(max_length=80, unique=True)
    emoji = models.CharField(max_length=8, default="📦")
    category = models.CharField(max_length=30, default="general")
    price = models.PositiveIntegerField(default=10)  # whole rupees
    stock = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category", "name"]

    def __str__(self):
        return self.name


class Order(models.Model):
    buyer = models.CharField(max_length=60, db_index=True)  # city bank username (verified)
    total = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name="items", on_delete=models.CASCADE)
    product = models.ForeignKey(Product, null=True, on_delete=models.SET_NULL)
    name = models.CharField(max_length=80)           # snapshot
    unit_price = models.PositiveIntegerField()       # snapshot
    quantity = models.PositiveIntegerField()


class Shift(models.Model):
    """One shelf-stocking shift. The server decides what it is worth, the browser only reports a score."""
    worker = models.CharField(max_length=60, db_index=True)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    stocked = models.PositiveIntegerField(default=0)
    wage = models.PositiveIntegerField(default=0)
