from django.db import models

class Book(models.Model):

    title = models.CharField(max_length=255)
    author = models.CharField(max_length=255, blank=True, null=True)
    rating = models.FloatField(blank=True, null=True) 
    
    description = models.TextField(blank=True, null=True)
    url = models.URLField(max_length=500, blank=True, null=True)

    summary = models.TextField(blank=True, null=True)
    genre = models.CharField(max_length=100, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    SUMMARY_SOURCES = [
        ("ollama", "Ollama"),
        ("gemini", "Gemini"),
        ("ollama_fallback", "Ollama Fallback"),
    ]

    summary_source = models.CharField(
        max_length=20,
        choices=SUMMARY_SOURCES,
        default="ollama"
    )

    def __str__(self):
        return self.title
        
