from django.db import models
from django.contrib.postgres.fields import ArrayField

# Create your models here.

class Product(models.Model):
    item_name = models.TextField(default="")
    price = models.DecimalField(default=0)
    inventory = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.item_name


class Cart(models.Model):
    items = models.ArrayField(models.CharField(max_length=50), blank=True, default=list)
    

