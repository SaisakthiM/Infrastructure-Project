from django.db import migrations

SEED = [
    # name, emoji, category, price (₹), stock
    ("Apple", "🍎", "produce", 25, 40),
    ("Banana", "🍌", "produce", 12, 60),
    ("Orange", "🍊", "produce", 20, 40),
    ("Carrot", "🥕", "produce", 15, 50),
    ("Tomato", "🍅", "produce", 18, 50),
    ("Avocado", "🥑", "produce", 60, 24),
    ("Bread", "🍞", "bakery", 45, 30),
    ("Croissant", "🥐", "bakery", 55, 24),
    ("Milk", "🥛", "dairy", 32, 40),
    ("Cheese", "🧀", "dairy", 90, 20),
    ("Eggs", "🥚", "dairy", 70, 30),
    ("Cold Drink", "🥤", "drinks", 40, 40),
]


def seed(apps, schema_editor):
    Product = apps.get_model("market", "Product")
    for name, emoji, category, price, stock in SEED:
        Product.objects.get_or_create(
            name=name, defaults={"emoji": emoji, "category": category, "price": price, "stock": stock}
        )


class Migration(migrations.Migration):
    dependencies = [("market", "0001_initial")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
