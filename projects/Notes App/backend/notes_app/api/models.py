from django.db import models
from django.contrib.auth.models import User

class Note(models.Model):
    IMPORTANCE_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notes")
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True)
    deadline = models.DateTimeField(null=True, blank=True)
    importance = models.CharField(max_length=10, choices=IMPORTANCE_CHOICES, default='medium')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title
