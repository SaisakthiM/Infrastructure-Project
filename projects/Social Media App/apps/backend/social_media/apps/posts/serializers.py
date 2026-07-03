from rest_framework import serializers
from .models import Post, PostMedia, Comment, Like, Save
from apps.users.serializers import UserMinimalSerializer


class PostMediaSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()

    class Meta:
        model = PostMedia
        fields = ['id', 'file', 'media_type', 'order']

    def get_file(self, obj):
        if not obj.file:
            return None
        url = obj.file.url
        # Rewrite internal docker hostnames to browser-accessible URLs
        url = url.replace('http://django:8000', 'http://localhost:8000')
        url = url.replace('http://minio:9000', 'http://localhost/social/minio')
        return url


class CommentSerializer(serializers.ModelSerializer):
    author = UserMinimalSerializer(read_only=True)
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'content', 'author', 'created_at', 'parent', 'replies']
        read_only_fields = ['id', 'author', 'created_at']

    def get_replies(self, obj):
        if obj.parent is None:
            qs = obj.replies.all()
            return CommentSerializer(qs, many=True, context=self.context).data
        return []


class PostSerializer(serializers.ModelSerializer):
    author = UserMinimalSerializer(read_only=True)
    media = PostMediaSerializer(many=True, read_only=True)
    likes_count = serializers.ReadOnlyField()
    comments_count = serializers.ReadOnlyField()
    is_liked = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'author', 'content', 'media',
            'likes_count', 'comments_count',
            'is_liked', 'is_saved',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Like.objects.filter(post=obj, user=request.user).exists()
        return False

    def get_is_saved(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Save.objects.filter(post=obj, user=request.user).exists()
        return False


class CreatePostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ['content']

    def create(self, validated_data):
        return Post.objects.create(author=self.context['request'].user, **validated_data)

