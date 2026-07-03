from rest_framework import serializers
from .models import Story, StoryView
from apps.users.serializers import UserMinimalSerializer


class StorySerializer(serializers.ModelSerializer):
    author = UserMinimalSerializer(read_only=True)
    media = serializers.SerializerMethodField()
    views_count = serializers.SerializerMethodField()
    is_viewed = serializers.SerializerMethodField()

    class Meta:
        model = Story
        fields = ['id', 'author', 'media', 'media_type', 'caption', 'created_at', 'expires_at', 'views_count', 'is_viewed']

    def get_media(self, obj):
        if not obj.media:
            return None
        url = obj.media.url
        url = url.replace('http://django:8000', 'http://localhost:8000')
        url = url.replace('http://minio:9000', 'http://localhost/social/minio')
        return url

    def get_views_count(self, obj):
        return obj.views.count()

    def get_is_viewed(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return StoryView.objects.filter(story=obj, viewer=request.user).exists()
        return False

