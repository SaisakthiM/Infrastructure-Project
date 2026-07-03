# models.py
from django.db import models
from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from PIL import Image as PilImage
import io


def resize_image(image_field, max_width, max_height, square=False):
    img = PilImage.open(image_field)
    img = img.convert('RGB')

    if square:
        w, h = img.size
        min_side = min(w, h)
        left = (w - min_side) // 2
        top = (h - min_side) // 2
        img = img.crop((left, top, left + min_side, top + min_side))
        img = img.resize((min_side, min_side), PilImage.LANCZOS)
    else:
        img.thumbnail((max_width, max_height), PilImage.LANCZOS)

    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=85, optimize=True)
    buffer.seek(0)
    return buffer


class Post(models.Model):
    title = models.CharField(max_length=200)
    content = models.TextField()
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    image = models.ImageField(upload_to='post_images/', blank=True, null=True)

    def save(self, *args, **kwargs):
        if self.image and hasattr(self.image, 'file'):
            buffer = resize_image(self.image, max_width=1200, max_height=800)
            # keep original filename but force .jpg extension
            original_name = self.image.name.rsplit('.', 1)[0] + '.jpg'
            self.image.save(original_name, ContentFile(buffer.read()), save=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    bio = models.TextField(blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)

    def save(self, *args, **kwargs):
        if self.avatar and hasattr(self.avatar, 'file'):
            buffer = resize_image(self.avatar, max_width=400, max_height=400, square=True)
            original_name = self.avatar.name.rsplit('.', 1)[0] + '.jpg'
            self.avatar.save(original_name, ContentFile(buffer.read()), save=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.user.username} Profile'


class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Comment by {self.author} on {self.post}'