from django.db import models


class User(models.Model):

    class Role(models.TextChoices):
        BUYER = "BY", "Buyer"
        SELLER = "SL", "Seller"

    username = models.CharField(max_length=100)
    role = models.CharField(
        max_length=2,
        choices=Role.choices
    )

    def __str__(self):
        return self.username

class Buyer(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    total_amount = models.IntegerField(default=0)


class Seller(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)

class Cart(models.Model):
    buyer = models.OneToOneField(Buyer, on_delete=models.CASCADE)


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE)
    product = models.ForeignKey("Product", on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)

class Items(models.Model):
    seller = models.OneToOneField(Seller, on_delete=models.CASCADE)

class ItemStock(models.Model):
    item = models.ForeignKey(Items, on_delete=models.CASCADE)
    product = models.ForeignKey("Product", on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)