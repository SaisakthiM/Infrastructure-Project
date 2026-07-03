from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta


def story_expiry():
    return timezone.now() + timedelta(hours=24)


class Story(models.Model):
    author = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='stories', on_delete=models.CASCADE)
    media = models.FileField(upload_to='stories/')
    media_type = models.CharField(max_length=10, choices=[('image', 'Image'), ('video', 'Video')], default='image')
    caption = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=story_expiry)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_active(self):
        return timezone.now() < self.expires_at


class StoryView(models.Model):
    story = models.ForeignKey(Story, related_name='views', on_delete=models.CASCADE)
    viewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('story', 'viewer')

