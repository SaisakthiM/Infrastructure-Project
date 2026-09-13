from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):

    class Role(models.TextChoices):
        BUYER = "BY", "Buyer"
        SELLER = "SL", "Seller"

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.CharField(
        max_length=2,
        choices=Role.choices
    )

class Product(models.Model):
    item_name = models.TextField(default="")
    price = models.DecimalField(default=0, decimal_places=2, max_digits=10)
    inventory = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.item_name


class Buyer(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)


class Seller(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)


class Cart(models.Model):
    buyer = models.OneToOneField(Buyer, on_delete=models.CASCADE)


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE)
    product = models.ForeignKey("Product", on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)


class ItemStock(models.Model):
    seller = models.ForeignKey(Seller, on_delete=models.CASCADE)
    product = models.ForeignKey("Product", on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=0)