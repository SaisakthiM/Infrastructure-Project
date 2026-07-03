#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  Nexus Social Media App — File Injection Script
#  Run: bash inject.sh
# ============================================================

PROJECT_ROOT='/home/saisakthi/Coding-Project/Projects/Unfinished Projects/Working On/Social Media App'

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${BLUE}→${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

echo ""
echo "  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗"
echo "  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝"
echo "  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗"
echo "  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║"
echo "  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║"
echo "  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝"
echo ""
echo "  Social Media App — Injection Script"
echo "  51 files across backend + frontend"
echo ""

info "Target: $PROJECT_ROOT"
echo ""

# Confirm
read -p "  Proceed? This will overwrite existing files. [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "  Aborted."
  exit 1
fi
echo ""

write_file() {
  local path="$1"
  local full="$PROJECT_ROOT/$path"
  mkdir -p "$(dirname "$full")"
  cat > "$full"
  log "$path"
}

# ── Writing files ──────────────────────────────────────────

write_file "backend/SETTINGS_ADDITIONS.py" << 'EOF_A03FCD47'
# ============================================================
# ADD / REPLACE these sections in your settings.py
# ============================================================

# --- INSTALLED_APPS ---
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_prometheus",
    # Local apps
    "apps.users",
    "apps.posts",
    "apps.stories",
    "apps.notifications",
    "apps.messages",
]

# --- MIDDLEWARE (add corsheaders near top) ---
MIDDLEWARE = [
    "django_prometheus.middleware.PrometheusBeforeMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "django_prometheus.middleware.PrometheusAfterMiddleware",
]

# --- AUTH USER ---
AUTH_USER_MODEL = "users.CustomUser"

# --- REST FRAMEWORK ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
}

# --- JWT ---
from datetime import timedelta
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=2),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

# --- CORS ---
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",   # Vite dev
    "http://localhost:80",     # Production nginx
    "http://localhost",
]
CORS_ALLOW_CREDENTIALS = True

# --- MEDIA FILES (MinIO / local fallback) ---
import os
MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

# --- If using MinIO with django-storages (production) ---
# DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
# AWS_ACCESS_KEY_ID = os.environ.get("MEDIA_STORAGE_KEY", "minio")
# AWS_SECRET_ACCESS_KEY = os.environ.get("MEDIA_STORAGE_SECRET", "minio123")
# AWS_STORAGE_BUCKET_NAME = "media"
# AWS_S3_ENDPOINT_URL = os.environ.get("MEDIA_STORAGE_URL", "http://minio:9000")
# AWS_DEFAULT_ACL = "public-read"
# AWS_S3_FILE_OVERWRITE = False

EOF_A03FCD47

write_file "backend/social_media/apps/messages/models.py" << 'EOF_38D5ED98'
from django.db import models
from django.conf import settings


class Conversation(models.Model):
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"Conversation {self.id}"

    @property
    def last_message(self):
        return self.messages.order_by('-created_at').first()


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, related_name='messages', on_delete=models.CASCADE)
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.TextField()
    media = models.FileField(upload_to='messages/', blank=True, null=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.sender}: {self.content[:50]}"

EOF_38D5ED98

write_file "backend/social_media/apps/messages/serializers.py" << 'EOF_3F2BF3E0'
from rest_framework import serializers
from .models import Conversation, Message
from apps.users.serializers import UserMinimalSerializer


class MessageSerializer(serializers.ModelSerializer):
    sender = UserMinimalSerializer(read_only=True)
    media = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'sender', 'content', 'media', 'is_read', 'created_at']
        read_only_fields = ['id', 'sender', 'is_read', 'created_at']

    def get_media(self, obj):
        request = self.context.get('request')
        if obj.media and request:
            return request.build_absolute_uri(obj.media.url)
        return None


class ConversationSerializer(serializers.ModelSerializer):
    participants = UserMinimalSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ['id', 'participants', 'last_message', 'unread_count', 'updated_at']

    def get_last_message(self, obj):
        msg = obj.last_message
        if msg:
            return MessageSerializer(msg, context=self.context).data
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
        return 0

EOF_3F2BF3E0

write_file "backend/social_media/apps/messages/urls.py" << 'EOF_C621893D'
from django.urls import path
from . import views

urlpatterns = [
    path('', views.conversations_list, name='conversations-list'),
    path('start/', views.get_or_create_conversation, name='start-conversation'),
    path('<int:pk>/messages/', views.conversation_messages, name='conversation-messages'),
    path('<int:pk>/send/', views.send_message, name='send-message'),
]

EOF_C621893D

write_file "backend/social_media/apps/messages/views.py" << 'EOF_3FDF7F0D'
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer

User = get_user_model()


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def conversations_list(request):
    convs = Conversation.objects.filter(participants=request.user).prefetch_related('participants', 'messages')
    return Response(ConversationSerializer(convs, many=True, context={'request': request}).data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def get_or_create_conversation(request):
    username = request.data.get('username')
    try:
        other_user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)

    # Find existing
    conv = Conversation.objects.filter(participants=request.user).filter(participants=other_user).first()
    if not conv:
        conv = Conversation.objects.create()
        conv.participants.add(request.user, other_user)
    return Response(ConversationSerializer(conv, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def conversation_messages(request, pk):
    conv = get_object_or_404(Conversation, pk=pk, participants=request.user)
    messages = conv.messages.select_related('sender')
    # Mark as read
    messages.filter(is_read=False).exclude(sender=request.user).update(is_read=True)
    page = int(request.query_params.get('page', 1))
    page_size = 30
    start = (page - 1) * page_size
    end = start + page_size
    msgs_list = list(messages)
    msgs_page = msgs_list[start:end]
    return Response({
        'results': MessageSerializer(msgs_page, many=True, context={'request': request}).data,
        'has_more': end < len(msgs_list),
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def send_message(request, pk):
    conv = get_object_or_404(Conversation, pk=pk, participants=request.user)
    content = request.data.get('content', '')
    media = request.FILES.get('media')
    if not content and not media:
        return Response({'detail': 'Message cannot be empty.'}, status=400)
    msg = Message.objects.create(
        conversation=conv,
        sender=request.user,
        content=content,
        media=media,
    )
    conv.save()  # bump updated_at
    return Response(MessageSerializer(msg, context={'request': request}).data, status=201)

EOF_3FDF7F0D

write_file "backend/social_media/apps/notifications/models.py" << 'EOF_96747A3E'
from django.db import models
from django.conf import settings


class Notification(models.Model):
    NOTIF_TYPES = [
        ('like', 'Like'),
        ('comment', 'Comment'),
        ('follow', 'Follow'),
        ('mention', 'Mention'),
        ('reply', 'Reply'),
    ]
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='notifications', on_delete=models.CASCADE)
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='sent_notifications', on_delete=models.CASCADE)
    notif_type = models.CharField(max_length=20, choices=NOTIF_TYPES)
    post = models.ForeignKey('posts.Post', null=True, blank=True, on_delete=models.CASCADE)
    comment = models.ForeignKey('posts.Comment', null=True, blank=True, on_delete=models.CASCADE)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.sender} -> {self.recipient}: {self.notif_type}"

EOF_96747A3E

write_file "backend/social_media/apps/notifications/serializers.py" << 'EOF_98ABFB4C'
from rest_framework import serializers
from .models import Notification
from apps.users.serializers import UserMinimalSerializer


class NotificationSerializer(serializers.ModelSerializer):
    sender = UserMinimalSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = ['id', 'sender', 'notif_type', 'post', 'comment', 'is_read', 'created_at']
        read_only_fields = ['id', 'sender', 'created_at']

EOF_98ABFB4C

write_file "backend/social_media/apps/notifications/urls.py" << 'EOF_2428A586'
from django.urls import path
from . import views

urlpatterns = [
    path('', views.notifications_list, name='notifications-list'),
    path('read/', views.mark_read, name='mark-read'),
    path('unread/', views.unread_count, name='unread-count'),
]

EOF_2428A586

write_file "backend/social_media/apps/notifications/views.py" << 'EOF_24954497'
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Notification
from .serializers import NotificationSerializer


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def notifications_list(request):
    notifs = Notification.objects.filter(recipient=request.user).select_related('sender', 'post', 'comment')
    page = int(request.query_params.get('page', 1))
    page_size = 20
    start = (page - 1) * page_size
    end = start + page_size
    return Response({
        'results': NotificationSerializer(notifs[start:end], many=True, context={'request': request}).data,
        'unread_count': notifs.filter(is_read=False).count(),
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_read(request):
    Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
    return Response({'marked': True})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def unread_count(request):
    count = Notification.objects.filter(recipient=request.user, is_read=False).count()
    return Response({'count': count})

EOF_24954497

write_file "backend/social_media/apps/posts/models.py" << 'EOF_110CE5E5'
from django.db import models
from django.conf import settings


class Post(models.Model):
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.author.username}: {self.content[:50]}"

    @property
    def likes_count(self):
        return self.likes.count()

    @property
    def comments_count(self):
        return self.comments.count()


class PostMedia(models.Model):
    MEDIA_TYPES = [('image', 'Image'), ('video', 'Video')]
    post = models.ForeignKey(Post, related_name='media', on_delete=models.CASCADE)
    file = models.FileField(upload_to='posts/')
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES, default='image')
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']


class Comment(models.Model):
    post = models.ForeignKey(Post, related_name='comments', on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    updated_at = models.DateTimeField(auto_now=True)
    parent = models.ForeignKey('self', null=True, blank=True, related_name='replies', on_delete=models.CASCADE)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.author.username} on post {self.post_id}"


class Like(models.Model):
    post = models.ForeignKey(Post, related_name='likes', on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('post', 'user')


class Save(models.Model):
    post = models.ForeignKey(Post, related_name='saves', on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('post', 'user')

EOF_110CE5E5

write_file "backend/social_media/apps/posts/serializers.py" << 'EOF_B4C55B5B'
from rest_framework import serializers
from .models import Post, PostMedia, Comment, Like, Save
from apps.users.serializers import UserMinimalSerializer


class PostMediaSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()

    class Meta:
        model = PostMedia
        fields = ['id', 'file', 'media_type', 'order']

    def get_file(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


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

EOF_B4C55B5B

write_file "backend/social_media/apps/posts/urls.py" << 'EOF_5C42B2CC'
from django.urls import path
from . import views

urlpatterns = [
    path('', views.feed, name='feed'),
    path('explore/', views.explore, name='explore'),
    path('create/', views.create_post, name='create-post'),
    path('search/', views.search_posts, name='search-posts'),
    path('saved/', views.saved_posts, name='saved-posts'),
    path('<int:pk>/', views.post_detail, name='post-detail'),
    path('<int:pk>/like/', views.like_toggle, name='like-toggle'),
    path('<int:pk>/save/', views.save_toggle, name='save-toggle'),
    path('<int:pk>/comments/', views.post_comments, name='post-comments'),
    path('comments/<int:pk>/', views.delete_comment, name='delete-comment'),
    path('user/<str:username>/', views.user_posts, name='user-posts'),
]

EOF_5C42B2CC

write_file "backend/social_media/apps/posts/views.py" << 'EOF_08C9CA81'
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.db.models import Q
from .models import Post, PostMedia, Comment, Like, Save
from .serializers import PostSerializer, CreatePostSerializer, CommentSerializer
from apps.users.models import Follow


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def feed(request):
    following_ids = Follow.objects.filter(follower=request.user).values_list('following_id', flat=True)
    posts = Post.objects.filter(
        Q(author_id__in=following_ids) | Q(author=request.user)
    ).select_related('author').prefetch_related('media', 'likes', 'comments')
    page = int(request.query_params.get('page', 1))
    page_size = 10
    start = (page - 1) * page_size
    end = start + page_size
    total = posts.count()
    posts_page = posts[start:end]
    return Response({
        'results': PostSerializer(posts_page, many=True, context={'request': request}).data,
        'total': total,
        'page': page,
        'has_next': end < total,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def explore(request):
    following_ids = Follow.objects.filter(follower=request.user).values_list('following_id', flat=True)
    posts = Post.objects.exclude(
        Q(author_id__in=following_ids) | Q(author=request.user)
    ).select_related('author').prefetch_related('media', 'likes', 'comments').order_by('-created_at')
    page = int(request.query_params.get('page', 1))
    page_size = 12
    start = (page - 1) * page_size
    end = start + page_size
    total = posts.count()
    return Response({
        'results': PostSerializer(posts[start:end], many=True, context={'request': request}).data,
        'total': total,
        'has_next': end < total,
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def create_post(request):
    serializer = CreatePostSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        post = serializer.save()
        files = request.FILES.getlist('media')
        for i, f in enumerate(files):
            media_type = 'video' if f.content_type.startswith('video') else 'image'
            PostMedia.objects.create(post=post, file=f, media_type=media_type, order=i)
        return Response(PostSerializer(post, context={'request': request}).data, status=201)
    return Response(serializer.errors, status=400)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def post_detail(request, pk):
    post = get_object_or_404(Post, pk=pk)
    if request.method == 'GET':
        return Response(PostSerializer(post, context={'request': request}).data)
    if post.author != request.user:
        return Response({'detail': 'Forbidden.'}, status=403)
    if request.method == 'DELETE':
        post.delete()
        return Response(status=204)
    if request.method == 'PUT':
        serializer = CreatePostSerializer(post, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(PostSerializer(post, context={'request': request}).data)
        return Response(serializer.errors, status=400)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def like_toggle(request, pk):
    post = get_object_or_404(Post, pk=pk)
    like, created = Like.objects.get_or_create(post=post, user=request.user)
    if not created:
        like.delete()
        return Response({'liked': False, 'likes_count': post.likes_count})

    # Create notification
    if post.author != request.user:
        from apps.notifications.models import Notification
        Notification.objects.get_or_create(
            recipient=post.author,
            sender=request.user,
            notif_type='like',
            post=post,
        )
    return Response({'liked': True, 'likes_count': post.likes_count})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def save_toggle(request, pk):
    post = get_object_or_404(Post, pk=pk)
    save, created = Save.objects.get_or_create(post=post, user=request.user)
    if not created:
        save.delete()
        return Response({'saved': False})
    return Response({'saved': True})


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def post_comments(request, pk):
    post = get_object_or_404(Post, pk=pk)
    if request.method == 'GET':
        comments = post.comments.filter(parent=None)
        return Response(CommentSerializer(comments, many=True, context={'request': request}).data)
    serializer = CommentSerializer(data=request.data)
    if serializer.is_valid():
        comment = serializer.save(author=request.user, post=post)
        if post.author != request.user:
            from apps.notifications.models import Notification
            Notification.objects.create(
                recipient=post.author,
                sender=request.user,
                notif_type='comment',
                post=post,
                comment=comment,
            )
        return Response(CommentSerializer(comment, context={'request': request}).data, status=201)
    return Response(serializer.errors, status=400)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_comment(request, pk):
    comment = get_object_or_404(Comment, pk=pk)
    if comment.author != request.user:
        return Response({'detail': 'Forbidden.'}, status=403)
    comment.delete()
    return Response(status=204)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def user_posts(request, username):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = get_object_or_404(User, username=username)
    posts = Post.objects.filter(author=user)
    return Response(PostSerializer(posts, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def saved_posts(request):
    posts = Post.objects.filter(saves__user=request.user)
    return Response(PostSerializer(posts, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def search_posts(request):
    q = request.query_params.get('q', '').strip()
    if not q:
        return Response([])
    posts = Post.objects.filter(content__icontains=q)[:20]
    return Response(PostSerializer(posts, many=True, context={'request': request}).data)

EOF_08C9CA81

write_file "backend/social_media/apps/stories/models.py" << 'EOF_6DA74367'
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

EOF_6DA74367

write_file "backend/social_media/apps/stories/serializers.py" << 'EOF_713162E1'
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
        request = self.context.get('request')
        if obj.media and request:
            return request.build_absolute_uri(obj.media.url)
        return None

    def get_views_count(self, obj):
        return obj.views.count()

    def get_is_viewed(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return StoryView.objects.filter(story=obj, viewer=request.user).exists()
        return False

EOF_713162E1

write_file "backend/social_media/apps/stories/urls.py" << 'EOF_1FF2754F'
from django.urls import path
from . import views

urlpatterns = [
    path('', views.stories_feed, name='stories-feed'),
    path('create/', views.create_story, name='create-story'),
    path('<int:pk>/delete/', views.delete_story, name='delete-story'),
    path('<int:pk>/view/', views.view_story, name='view-story'),
]

EOF_1FF2754F

write_file "backend/social_media/apps/stories/views.py" << 'EOF_2103ECA1'
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.utils import timezone
from django.shortcuts import get_object_or_404
from .models import Story, StoryView
from .serializers import StorySerializer
from apps.users.models import Follow
from django.contrib.auth import get_user_model

User = get_user_model()


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def stories_feed(request):
    following_ids = Follow.objects.filter(follower=request.user).values_list('following_id', flat=True)
    user_ids = list(following_ids) + [request.user.id]
    stories = Story.objects.filter(
        author_id__in=user_ids,
        expires_at__gt=timezone.now()
    ).select_related('author').order_by('-created_at')
    # Group by author
    grouped = {}
    for story in stories:
        uid = story.author_id
        if uid not in grouped:
            grouped[uid] = {
                'user': {'id': story.author.id, 'username': story.author.username, 'profile_name': story.author.profile_name},
                'stories': [],
                'has_unseen': False,
            }
        s_data = StorySerializer(story, context={'request': request}).data
        if not s_data['is_viewed']:
            grouped[uid]['has_unseen'] = True
        grouped[uid]['stories'].append(s_data)
    return Response(list(grouped.values()))


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def create_story(request):
    media = request.FILES.get('media')
    if not media:
        return Response({'detail': 'Media required.'}, status=400)
    media_type = 'video' if media.content_type.startswith('video') else 'image'
    story = Story.objects.create(
        author=request.user,
        media=media,
        media_type=media_type,
        caption=request.data.get('caption', ''),
    )
    return Response(StorySerializer(story, context={'request': request}).data, status=201)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_story(request, pk):
    story = get_object_or_404(Story, pk=pk, author=request.user)
    story.delete()
    return Response(status=204)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def view_story(request, pk):
    story = get_object_or_404(Story, pk=pk)
    StoryView.objects.get_or_create(story=story, viewer=request.user)
    return Response({'viewed': True})

EOF_2103ECA1

write_file "backend/social_media/apps/users/models.py" << 'EOF_1A9D19BE'
from django.contrib.auth.models import AbstractUser, Group, Permission
from django.db import models


class CustomUser(AbstractUser):
    profile_name = models.CharField(max_length=150, unique=True, db_index=True)
    bio = models.TextField(blank=True, null=True)
    profile_picture = models.ImageField(upload_to='profiles/', blank=True, null=True)
    website = models.URLField(blank=True, null=True)
    is_private = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    groups = models.ManyToManyField(
        Group,
        related_name='customuser_set',
        blank=True,
    )
    user_permissions = models.ManyToManyField(
        Permission,
        related_name='customuser_permissions_set',
        blank=True,
    )

    def __str__(self):
        return self.username

    @property
    def followers_count(self):
        return self.followers.count()

    @property
    def following_count(self):
        return self.following.count()

    @property
    def posts_count(self):
        return self.post_set.count()


class Follow(models.Model):
    follower = models.ForeignKey(CustomUser, related_name='following', on_delete=models.CASCADE)
    following = models.ForeignKey(CustomUser, related_name='followers', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('follower', 'following')

    def __str__(self):
        return f"{self.follower} -> {self.following}"

EOF_1A9D19BE

write_file "backend/social_media/apps/users/serializers.py" << 'EOF_42FFAF5D'
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import CustomUser, Follow


class UserMinimalSerializer(serializers.ModelSerializer):
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'profile_name', 'profile_picture']

    def get_profile_picture(self, obj):
        request = self.context.get('request')
        if obj.profile_picture and request:
            return request.build_absolute_uri(obj.profile_picture.url)
        return None


class UserSerializer(serializers.ModelSerializer):
    profile_picture = serializers.SerializerMethodField()
    followers_count = serializers.ReadOnlyField()
    following_count = serializers.ReadOnlyField()
    posts_count = serializers.ReadOnlyField()
    is_following = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'profile_name', 'email', 'bio',
            'profile_picture', 'website', 'is_private',
            'followers_count', 'following_count', 'posts_count',
            'is_following', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_profile_picture(self, obj):
        request = self.context.get('request')
        if obj.profile_picture and request:
            return request.build_absolute_uri(obj.profile_picture.url)
        return None

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Follow.objects.filter(follower=request.user, following=obj).exists()
        return False


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = ['username', 'email', 'profile_name', 'password', 'password2']

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({'password': 'Passwords do not match.'})
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        user = CustomUser.objects.create_user(**validated_data)
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(username=data['username'], password=data['password'])
        if not user:
            raise serializers.ValidationError('Invalid credentials.')
        if not user.is_active:
            raise serializers.ValidationError('Account disabled.')
        tokens = RefreshToken.for_user(user)
        return {
            'user': user,
            'access': str(tokens.access_token),
            'refresh': str(tokens),
        }


class UpdateProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['profile_name', 'bio', 'profile_picture', 'website', 'is_private']

EOF_42FFAF5D

write_file "backend/social_media/apps/users/urls.py" << 'EOF_8623CB53'
from django.urls import path
from . import views

urlpatterns = [
    path('auth/register/', views.register, name='register'),
    path('auth/login/', views.login, name='login'),
    path('auth/logout/', views.logout, name='logout'),
    path('auth/me/', views.me, name='me'),
    path('users/search/', views.search_users, name='search-users'),
    path('users/suggested/', views.suggested_users, name='suggested-users'),
    path('users/<str:username>/', views.user_profile, name='user-profile'),
    path('users/<str:username>/update/', views.update_profile, name='update-profile'),
    path('users/<str:username>/follow/', views.follow_toggle, name='follow-toggle'),
    path('users/<str:username>/followers/', views.followers_list, name='followers-list'),
    path('users/<str:username>/following/', views.following_list, name='following-list'),
]

EOF_8623CB53

write_file "backend/social_media/apps/users/views.py" << 'EOF_3BB00FC2'
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.db.models import Q
from .models import Follow
from .serializers import (
    UserSerializer, UserMinimalSerializer,
    RegisterSerializer, LoginSerializer, UpdateProfileSerializer
)

User = get_user_model()


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        tokens = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user, context={'request': request}).data,
            'access': str(tokens.access_token),
            'refresh': str(tokens),
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        data = serializer.validated_data
        return Response({
            'user': UserSerializer(data['user'], context={'request': request}).data,
            'access': data['access'],
            'refresh': data['refresh'],
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout(request):
    try:
        token = RefreshToken(request.data.get('refresh'))
        token.blacklist()
    except Exception:
        pass
    return Response({'detail': 'Logged out.'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def user_profile(request, username):
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)
    return Response(UserSerializer(user, context={'request': request}).data)


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def update_profile(request):
    serializer = UpdateProfileSerializer(request.user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(UserSerializer(request.user, context={'request': request}).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def follow_toggle(request, username):
    try:
        target = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)
    if target == request.user:
        return Response({'detail': 'Cannot follow yourself.'}, status=400)

    follow, created = Follow.objects.get_or_create(follower=request.user, following=target)
    if not created:
        follow.delete()
        return Response({'following': False})
    return Response({'following': True})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def followers_list(request, username):
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)
    followers = User.objects.filter(following__following=user)
    return Response(UserMinimalSerializer(followers, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def following_list(request, username):
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)
    following = User.objects.filter(followers__follower=user)
    return Response(UserMinimalSerializer(following, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def search_users(request):
    q = request.query_params.get('q', '').strip()
    if not q:
        return Response([])
    users = User.objects.filter(
        Q(username__icontains=q) | Q(profile_name__icontains=q)
    ).exclude(id=request.user.id)[:20]
    return Response(UserMinimalSerializer(users, many=True, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def suggested_users(request):
    following_ids = Follow.objects.filter(follower=request.user).values_list('following_id', flat=True)
    users = User.objects.exclude(id=request.user.id).exclude(id__in=following_ids).order_by('?')[:6]
    return Response(UserMinimalSerializer(users, many=True, context={'request': request}).data)

EOF_3BB00FC2

write_file "backend/social_media/social_media/urls.py" << 'EOF_5A3B4B20'
from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.conf.urls.static import static


def health_check(request):
    return JsonResponse({"status": "healthy"}, status=200)


urlpatterns = [
    path("health/", health_check),
    path("admin/", admin.site.urls),
    path("api/", include("apps.users.urls")),
    path("api/posts/", include("apps.posts.urls")),
    path("api/stories/", include("apps.stories.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/messages/", include("apps.messages.urls")),
    path("", include("django_prometheus.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

EOF_5A3B4B20

write_file "frontend/src/App.jsx" << 'EOF_19AEECDD'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import Layout     from './components/layout/Layout';
import { Spinner } from './components/common/Loaders';

import LoginPage        from './pages/LoginPage';
import RegisterPage     from './pages/RegisterPage';
import HomePage         from './pages/HomePage';
import ExplorePage      from './pages/ExplorePage';
import SearchPage       from './pages/SearchPage';
import ProfilePage      from './pages/ProfilePage';
import MessagesPage     from './pages/MessagesPage';
import NotificationsPage from './pages/NotificationsPage';
import ReelsPage        from './pages/ReelsPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
  return !user ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Guest routes */}
      <Route path="/login"    element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

      {/* Protected routes inside Layout */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/"                       element={<HomePage />} />
        <Route path="/explore"                element={<ExplorePage />} />
        <Route path="/search"                 element={<SearchPage />} />
        <Route path="/reels"                  element={<ReelsPage />} />
        <Route path="/messages"               element={<MessagesPage />} />
        <Route path="/notifications"          element={<NotificationsPage />} />
        <Route path="/profile/:username"      element={<ProfilePage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <ToastContainer
          position="bottom-right"
          theme="dark"
          toastStyle={{
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            borderRadius: '12px',
            fontSize: '14px',
          }}
          autoClose={3000}
          hideProgressBar
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

EOF_19AEECDD

write_file "frontend/src/api/index.js" << 'EOF_353E08D4'
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh');
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh });
          localStorage.setItem('access', data.access);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ────────────────────────────────────────────────────
export const authAPI = {
  register: (d) => api.post('/auth/register/', d),
  login:    (d) => api.post('/auth/login/', d),
  logout:   (d) => api.post('/auth/logout/', d),
  me:       ()  => api.get('/auth/me/'),
};

// ── Users ───────────────────────────────────────────────────
export const usersAPI = {
  profile:   (username)  => api.get(`/users/${username}/`),
  update:    (username, d) => api.patch(`/users/${username}/update/`, d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  follow:    (username)  => api.post(`/users/${username}/follow/`),
  followers: (username)  => api.get(`/users/${username}/followers/`),
  following: (username)  => api.get(`/users/${username}/following/`),
  search:    (q)         => api.get('/users/search/', { params: { q } }),
  suggested: ()          => api.get('/users/suggested/'),
};

// ── Posts ───────────────────────────────────────────────────
export const postsAPI = {
  feed:        (page = 1)  => api.get('/posts/', { params: { page } }),
  explore:     (page = 1)  => api.get('/posts/explore/', { params: { page } }),
  create:      (d)         => api.post('/posts/create/', d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  get:         (id)        => api.get(`/posts/${id}/`),
  delete:      (id)        => api.delete(`/posts/${id}/`),
  like:        (id)        => api.post(`/posts/${id}/like/`),
  save:        (id)        => api.post(`/posts/${id}/save/`),
  comments:    (id)        => api.get(`/posts/${id}/comments/`),
  addComment:  (id, d)     => api.post(`/posts/${id}/comments/`, d),
  delComment:  (id)        => api.delete(`/posts/comments/${id}/`),
  userPosts:   (username)  => api.get(`/posts/user/${username}/`),
  saved:       ()          => api.get('/posts/saved/'),
  search:      (q)         => api.get('/posts/search/', { params: { q } }),
};

// ── Stories ─────────────────────────────────────────────────
export const storiesAPI = {
  feed:   ()   => api.get('/stories/'),
  create: (d)  => api.post('/stories/create/', d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/stories/${id}/delete/`),
  view:   (id) => api.post(`/stories/${id}/view/`),
};

// ── Notifications ────────────────────────────────────────────
export const notifsAPI = {
  list:     (page = 1) => api.get('/notifications/', { params: { page } }),
  markRead: ()         => api.post('/notifications/read/'),
  unread:   ()         => api.get('/notifications/unread/'),
};

// ── Messages ─────────────────────────────────────────────────
export const messagesAPI = {
  conversations: ()       => api.get('/messages/'),
  start:         (username) => api.post('/messages/start/', { username }),
  messages:      (id, page = 1) => api.get(`/messages/${id}/messages/`, { params: { page } }),
  send:          (id, d)  => api.post(`/messages/${id}/send/`, d, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

EOF_353E08D4

write_file "frontend/src/components/common/Avatar.jsx" << 'EOF_61403772'
import { getInitials } from '../../utils';

const sizes = {
  xs:  'w-6 h-6 text-[10px]',
  sm:  'w-8 h-8 text-xs',
  md:  'w-10 h-10 text-sm',
  lg:  'w-14 h-14 text-base',
  xl:  'w-20 h-20 text-xl',
  '2xl': 'w-28 h-28 text-2xl',
};

export default function Avatar({ user, size = 'md', className = '', ring = false, onClick }) {
  const sizeClass = sizes[size] || sizes.md;
  const ringClass = ring ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-[#0d0d0d]' : '';

  if (user?.profile_picture) {
    return (
      <img
        src={user.profile_picture}
        alt={user.username}
        onClick={onClick}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${ringClass} ${className} ${onClick ? 'cursor-pointer' : ''}`}
      />
    );
  }

  return (
    <div
      onClick={onClick}
      className={`
        ${sizeClass} rounded-full flex-shrink-0 flex items-center justify-center
        bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white font-bold
        ${ringClass} ${className} ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {getInitials(user?.profile_name || user?.username || '?')}
    </div>
  );
}

EOF_61403772

write_file "frontend/src/components/common/Loaders.jsx" << 'EOF_AC448A55'
export function Spinner({ size = 'md', className = '' }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }[size];
  return (
    <div className={`${s} border-2 border-white/10 border-t-violet-500 rounded-full animate-spin ${className}`} />
  );
}

export function PostSkeleton() {
  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/10" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3 w-32 bg-white/10 rounded" />
          <div className="h-2.5 w-20 bg-white/5 rounded" />
        </div>
      </div>
      <div className="h-40 bg-white/5 rounded-xl" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-white/5 rounded" />
        <div className="h-3 w-3/4 bg-white/5 rounded" />
      </div>
    </div>
  );
}

export function UserCardSkeleton() {
  return (
    <div className="flex items-center gap-3 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-white/10" />
      <div className="space-y-1.5 flex-1">
        <div className="h-3 w-24 bg-white/10 rounded" />
        <div className="h-2.5 w-16 bg-white/5 rounded" />
      </div>
    </div>
  );
}

EOF_AC448A55

write_file "frontend/src/components/common/Modal.jsx" << 'EOF_43918C80'
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoClose } from 'react-icons/io5';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else      document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-full' };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className={`relative z-10 w-full ${widths[size]} bg-[#111] border border-white/10 rounded-2xl shadow-2xl`}
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1,    opacity: 1, y: 0  }}
            exit={{    scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: 'spring', duration: 0.3 }}
          >
            {title && (
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h2 className="font-semibold text-white text-base">{title}</h2>
                <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                  <IoClose size={20} />
                </button>
              </div>
            )}
            {!title && (
              <button
                onClick={onClose}
                className="absolute top-3 right-3 z-10 text-white/40 hover:text-white transition-colors"
              >
                <IoClose size={20} />
              </button>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

EOF_43918C80

write_file "frontend/src/components/layout/Layout.jsx" << 'EOF_D6782461'
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import CreatePostModal from '../posts/CreatePostModal';

export default function Layout() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <Sidebar onCreatePost={() => setCreateOpen(true)} />

      {/* Page content */}
      <main className="md:pl-[72px] xl:pl-56 pb-16 md:pb-0 min-h-screen">
        <Outlet />
      </main>

      <CreatePostModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

EOF_D6782461

write_file "frontend/src/components/layout/RightPanel.jsx" << 'EOF_1A4D2068'
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usersAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useFollow } from '../../hooks';
import Avatar from '../common/Avatar';
import { UserCardSkeleton } from '../common/Loaders';

function SuggestedUser({ user }) {
  const { following, toggle } = useFollow(user.username, false);

  return (
    <div className="flex items-center justify-between">
      <Link to={`/profile/${user.username}`} className="flex items-center gap-2.5 group min-w-0">
        <Avatar user={user} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white group-hover:text-violet-400 transition-colors truncate leading-tight">
            {user.profile_name || user.username}
          </p>
          <p className="text-xs text-white/30 truncate">@{user.username}</p>
        </div>
      </Link>
      <button
        onClick={toggle}
        className={`flex-shrink-0 ml-2 text-xs font-semibold transition-colors ${
          following ? 'text-white/40 hover:text-white' : 'text-violet-400 hover:text-violet-300'
        }`}
      >
        {following ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}

export default function RightPanel() {
  const { user }              = useAuth();
  const [suggested, setSuggested] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    usersAPI.suggested().then(({ data }) => {
      setSuggested(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Logged-in user */}
      <div className="flex items-center gap-3">
        <Avatar user={user} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{user?.profile_name || user?.username}</p>
          <p className="text-xs text-white/40 truncate">@{user?.username}</p>
        </div>
        <Link to={`/profile/${user?.username}`} className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors flex-shrink-0">
          View
        </Link>
      </div>

      {/* Suggestions */}
      {(loading || suggested.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Suggested for you</p>
          </div>
          <div className="space-y-3">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <UserCardSkeleton key={i} />)
              : suggested.map((u) => <SuggestedUser key={u.id} user={u} />)
            }
          </div>
        </div>
      )}

      <p className="text-[11px] text-white/15 leading-relaxed">
        © 2025 Nexus · Built with React + Django
      </p>
    </div>
  );
}

EOF_1A4D2068

write_file "frontend/src/components/layout/Sidebar.jsx" << 'EOF_66D50B28'
import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { notifsAPI } from '../../api';
import Avatar from '../common/Avatar';
import {
  IoHomeOutline, IoHome,
  IoSearchOutline, IoSearch,
  IoCompassOutline, IoCompass,
  IoFilmOutline, IoFilm,
  IoChatbubbleOutline, IoChatbubble,
  IoHeartOutline, IoHeart,
  IoAddCircleOutline, IoPersonOutline, IoPerson,
  IoLogOutOutline,
} from 'react-icons/io5';

export default function Sidebar({ onCreatePost }) {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await notifsAPI.unread();
        setUnread(data.count);
      } catch {}
    };
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, []);

  const navItems = [
    { to: '/',            label: 'Home',          icon: IoHomeOutline,      activeIcon: IoHome         },
    { to: '/search',      label: 'Search',        icon: IoSearchOutline,    activeIcon: IoSearch       },
    { to: '/explore',     label: 'Explore',       icon: IoCompassOutline,   activeIcon: IoCompass      },
    { to: '/reels',       label: 'Reels',         icon: IoFilmOutline,      activeIcon: IoFilm         },
    { to: '/messages',    label: 'Messages',      icon: IoChatbubbleOutline,activeIcon: IoChatbubble   },
    { to: '/notifications', label: 'Notifications', icon: IoHeartOutline,   activeIcon: IoHeart, badge: unread },
    { to: `/profile/${user?.username}`, label: 'Profile', icon: IoPersonOutline, activeIcon: IoPerson },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-[72px] xl:w-56 bg-[#0a0a0a] border-r border-white/5 z-40 py-6 px-3 xl:px-4">
        {/* Logo */}
        <div className="mb-8 px-2 xl:px-0">
          <span className="text-xl font-black bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent hidden xl:block">
            nexus
          </span>
          <span className="text-2xl xl:hidden">⬡</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ to, label, icon: Icon, activeIcon: ActiveIcon, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `
                flex items-center gap-4 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                ${isActive
                  ? 'bg-white/8 text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/5'}
              `}
            >
              {({ isActive }) => (
                <>
                  <span className="relative flex-shrink-0">
                    {isActive ? <ActiveIcon size={22} /> : <Icon size={22} />}
                    {badge > 0 && (
                      <span className="absolute -top-1 -right-1 bg-violet-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </span>
                  <span className="hidden xl:block text-sm font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* Create post */}
          <button
            onClick={onCreatePost}
            className="flex items-center gap-4 px-3 py-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all mt-1"
          >
            <IoAddCircleOutline size={22} className="flex-shrink-0" />
            <span className="hidden xl:block text-sm font-medium">Create</span>
          </button>
        </nav>

        {/* User + logout */}
        <div className="mt-4 border-t border-white/5 pt-4 space-y-1">
          <button
            onClick={() => navigate(`/profile/${user?.username}`)}
            className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 w-full transition-all"
          >
            <Avatar user={user} size="sm" />
            <div className="hidden xl:block text-left">
              <p className="text-xs font-semibold text-white leading-tight">{user?.profile_name || user?.username}</p>
              <p className="text-[11px] text-white/40">@{user?.username}</p>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-4 px-3 py-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/5 transition-all w-full"
          >
            <IoLogOutOutline size={20} className="flex-shrink-0" />
            <span className="hidden xl:block text-sm">Log out</span>
          </button>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur border-t border-white/5 z-40 flex items-center justify-around px-2 py-2">
        {[navItems[0], navItems[1], navItems[2], navItems[4], navItems[6]].map(({ to, label, icon: Icon, activeIcon: ActiveIcon, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all ${isActive ? 'text-white' : 'text-white/40'}`
            }
          >
            {({ isActive }) => (
              <span className="relative">
                {isActive ? <ActiveIcon size={22} /> : <Icon size={22} />}
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-violet-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </span>
            )}
          </NavLink>
        ))}
        <button onClick={onCreatePost} className="text-white/40 hover:text-white transition-all px-3 py-1">
          <IoAddCircleOutline size={24} />
        </button>
      </nav>
    </>
  );
}

EOF_66D50B28

write_file "frontend/src/components/posts/CommentsDrawer.jsx" << 'EOF_FDDF6979'
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoClose, IoPaperPlane, IoHeartOutline } from 'react-icons/io5';
import { postsAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';
import { timeAgo } from '../../utils';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';

export default function CommentsDrawer({ open, onClose, post, onUpdate }) {
  const { user }              = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText]       = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef              = useRef(null);

  useEffect(() => {
    if (!open) return;
    postsAPI.comments(post.id).then(({ data }) => setComments(data)).catch(() => {});
  }, [open, post.id]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const { data } = await postsAPI.addComment(post.id, { content: text.trim() });
      setComments((c) => [...c, data]);
      onUpdate?.({ comments_count: post.comments_count + 1 });
      setText('');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setLoading(false);
    }
  };

  const deleteComment = async (id) => {
    try {
      await postsAPI.delComment(id);
      setComments((c) => c.filter((x) => x.id !== id));
      onUpdate?.({ comments_count: Math.max(0, post.comments_count - 1) });
    } catch {}
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 md:right-auto md:left-auto md:top-0 md:bottom-0 md:w-[420px] bg-[#111] border-t md:border-t-0 md:border-l border-white/10 z-50 flex flex-col rounded-t-3xl md:rounded-none"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ maxHeight: '85vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
              <h3 className="font-semibold text-sm">Comments</h3>
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                <IoClose size={20} />
              </button>
            </div>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {comments.length === 0 && (
                <p className="text-center text-white/30 text-sm py-8">No comments yet. Be the first!</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3 group">
                  <Link to={`/profile/${c.author.username}`}>
                    <Avatar user={c.author} size="sm" />
                  </Link>
                  <div className="flex-1">
                    <p className="text-sm">
                      <Link to={`/profile/${c.author.username}`} className="font-semibold text-white hover:text-violet-400 transition-colors mr-1.5">
                        {c.author.username}
                      </Link>
                      <span className="text-white/70">{c.content}</span>
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-white/30">{timeAgo(c.created_at)}</span>
                      {c.author.id === user?.id && (
                        <button
                          onClick={() => deleteComment(c.id)}
                          className="text-xs text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    {/* Replies */}
                    {c.replies?.map((r) => (
                      <div key={r.id} className="flex gap-2 mt-3">
                        <Avatar user={r.author} size="xs" />
                        <div>
                          <p className="text-sm">
                            <Link to={`/profile/${r.author.username}`} className="font-semibold text-white mr-1.5">
                              {r.author.username}
                            </Link>
                            <span className="text-white/70">{r.content}</span>
                          </p>
                          <span className="text-xs text-white/30">{timeAgo(r.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 mt-1">
                    <IoHeartOutline size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={submit} className="flex items-center gap-3 px-4 py-3 border-t border-white/10 flex-shrink-0">
              <Avatar user={user} size="sm" />
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
              />
              <button
                type="submit"
                disabled={!text.trim() || loading}
                className="text-violet-400 hover:text-violet-300 disabled:opacity-30 transition-colors"
              >
                <IoPaperPlane size={18} />
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

EOF_FDDF6979

write_file "frontend/src/components/posts/CreatePostModal.jsx" << 'EOF_2A36740A'
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { IoCloudUploadOutline, IoClose, IoImageOutline } from 'react-icons/io5';
import Modal from '../common/Modal';
import { postsAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';
import { Spinner } from '../common/Loaders';
import { toast } from 'react-toastify';

export default function CreatePostModal({ open, onClose }) {
  const { user }             = useAuth();
  const [content, setContent]   = useState('');
  const [files, setFiles]       = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading]   = useState(false);
  const fileRef                 = useRef(null);

  const handleFiles = (selected) => {
    const arr = Array.from(selected).slice(0, 10);
    setFiles(arr);
    setPreviews(arr.map((f) => ({ url: URL.createObjectURL(f), type: f.type })));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (i) => {
    setFiles((f) => f.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const submit = async () => {
    if (!content.trim() && files.length === 0) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('content', content);
      files.forEach((f) => fd.append('media', f));
      await postsAPI.create(fd);
      toast.success('Post shared!');
      setContent('');
      setFiles([]);
      setPreviews([]);
      onClose();
    } catch {
      toast.error('Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setContent('');
    setFiles([]);
    setPreviews([]);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Create post" size="md">
      <div className="p-4 space-y-4">
        {/* Author */}
        <div className="flex items-center gap-3">
          <Avatar user={user} size="md" />
          <div>
            <p className="text-sm font-semibold">{user?.profile_name || user?.username}</p>
            <p className="text-xs text-white/40">@{user?.username}</p>
          </div>
        </div>

        {/* Text input */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          rows={4}
          className="w-full bg-transparent text-white/90 placeholder-white/25 text-sm leading-relaxed resize-none outline-none"
          autoFocus
        />

        {/* Media previews */}
        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {previews.map((p, i) => (
              <div key={i} className="relative aspect-square group">
                {p.type.startsWith('video') ? (
                  <video src={p.url} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <img src={p.url} alt="" className="w-full h-full object-cover rounded-lg" />
                )}
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <IoClose size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload zone */}
        {previews.length === 0 && (
          <div
            className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center cursor-pointer hover:border-violet-500/50 hover:bg-violet-500/5 transition-all"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
          >
            <IoCloudUploadOutline size={28} className="mx-auto text-white/30 mb-2" />
            <p className="text-sm text-white/40">Drop photos/videos here or <span className="text-violet-400">browse</span></p>
          </div>
        )}

        {previews.length > 0 && (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
          >
            <IoImageOutline size={16} /> Add more
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <span className="text-xs text-white/25">{content.length} chars</span>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={loading || (!content.trim() && files.length === 0)}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all flex items-center gap-2"
            >
              {loading && <Spinner size="sm" />}
              Share
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

EOF_2A36740A

write_file "frontend/src/components/posts/PostCard.jsx" << 'EOF_6742A0A0'
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IoHeartOutline, IoHeart,
  IoChatbubbleOutline,
  IoBookmarkOutline, IoBookmark,
  IoPaperPlaneOutline,
  IoEllipsisHorizontal, IoTrashOutline,
} from 'react-icons/io5';
import Avatar from '../common/Avatar';
import { useLike, useSave } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { postsAPI } from '../../api';
import { timeAgo, formatNumber } from '../../utils';
import { toast } from 'react-toastify';
import CommentsDrawer from './CommentsDrawer';

export default function PostCard({ post, onUpdate, onRemove }) {
  const { user }       = useAuth();
  const navigate       = useNavigate();
  const [showMenu, setShowMenu]       = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [mediaIdx, setMediaIdx]       = useState(0);

  const { liked, count: likesCount, toggle: toggleLike } = useLike(post, onUpdate);
  const { saved, toggle: toggleSave }                    = useSave(post, onUpdate);

  const isOwner = user?.id === post.author.id;

  const handleDelete = async () => {
    if (!confirm('Delete this post?')) return;
    try {
      await postsAPI.delete(post.id);
      onRemove?.(post.id);
      toast.success('Post deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleDoubleTap = () => {
    if (!liked) toggleLike();
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link to={`/profile/${post.author.username}`} className="flex items-center gap-2.5 group">
          <Avatar user={post.author} size="sm" />
          <div>
            <p className="text-sm font-semibold text-white group-hover:text-violet-400 transition-colors leading-tight">
              {post.author.profile_name || post.author.username}
            </p>
            <p className="text-xs text-white/40">@{post.author.username} · {timeAgo(post.created_at)}</p>
          </div>
        </Link>
        {isOwner && (
          <div className="relative">
            <button
              onClick={() => setShowMenu((s) => !s)}
              className="text-white/30 hover:text-white p-1 rounded-lg transition-colors"
            >
              <IoEllipsisHorizontal size={18} />
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -4 }}
                  animate={{ opacity: 1, scale: 1,   y: 0  }}
                  exit={{   opacity: 0, scale: 0.9, y: -4  }}
                  className="absolute right-0 top-8 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-10 overflow-hidden w-36"
                >
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <IoTrashOutline size={15} /> Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Media */}
      {post.media?.length > 0 && (
        <div className="relative bg-black" onDoubleClick={handleDoubleTap}>
          <img
            src={post.media[mediaIdx].file}
            alt=""
            className="w-full max-h-[520px] object-cover cursor-pointer"
            onClick={() => navigate(`/post/${post.id}`)}
          />
          {post.media.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {post.media.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setMediaIdx(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === mediaIdx ? 'bg-white w-3' : 'bg-white/40'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleLike}
              className={`transition-all active:scale-90 ${liked ? 'text-red-500' : 'text-white/60 hover:text-white'}`}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={liked ? 'liked' : 'unliked'}
                  initial={{ scale: 0.7 }}
                  animate={{ scale: 1 }}
                  exit={{    scale: 0.7 }}
                >
                  {liked ? <IoHeart size={22} /> : <IoHeartOutline size={22} />}
                </motion.span>
              </AnimatePresence>
            </button>
            <button
              onClick={() => setShowComments(true)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <IoChatbubbleOutline size={21} />
            </button>
            <button className="text-white/60 hover:text-white transition-colors">
              <IoPaperPlaneOutline size={21} />
            </button>
          </div>
          <button
            onClick={toggleSave}
            className={`transition-all ${saved ? 'text-violet-400' : 'text-white/60 hover:text-white'}`}
          >
            {saved ? <IoBookmark size={21} /> : <IoBookmarkOutline size={21} />}
          </button>
        </div>

        {/* Counts */}
        {likesCount > 0 && (
          <p className="text-sm font-semibold text-white mb-1">{formatNumber(likesCount)} likes</p>
        )}

        {/* Caption */}
        {post.content && (
          <p className="text-sm text-white/80 leading-relaxed">
            <Link to={`/profile/${post.author.username}`} className="font-semibold text-white mr-1.5 hover:text-violet-400 transition-colors">
              {post.author.username}
            </Link>
            {post.content}
          </p>
        )}

        {/* Comments preview */}
        {post.comments_count > 0 && (
          <button
            onClick={() => setShowComments(true)}
            className="text-sm text-white/30 hover:text-white/60 transition-colors mt-1 block"
          >
            View all {post.comments_count} comments
          </button>
        )}
      </div>

      {/* Comments drawer */}
      <CommentsDrawer
        open={showComments}
        onClose={() => setShowComments(false)}
        post={post}
        onUpdate={onUpdate}
      />
    </motion.article>
  );
}

EOF_6742A0A0

write_file "frontend/src/components/posts/PostDetailModal.jsx" << 'EOF_FC62AB51'
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { IoClose, IoHeartOutline, IoHeart, IoChatbubbleOutline, IoBookmarkOutline, IoBookmark } from 'react-icons/io5';
import Avatar from '../common/Avatar';
import { useLike, useSave } from '../../hooks';
import { timeAgo, formatNumber } from '../../utils';
import CommentsDrawer from './CommentsDrawer';

export default function PostDetailModal({ post: initialPost, onClose }) {
  const [post, setPost]           = useState(initialPost);
  const [showComments, setShowComments] = useState(false);

  const update = (patch) => setPost((p) => ({ ...p, ...patch }));
  const { liked, count, toggle }  = useLike(post, update);
  const { saved, toggle: toggleSave } = useSave(post, update);

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col md:flex-row"
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.94, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Media */}
          {post.media?.[0] && (
            <div className="md:w-1/2 bg-black flex items-center">
              <img src={post.media[0].file} alt="" className="w-full object-contain max-h-[70vh]" />
            </div>
          )}

          {/* Info */}
          <div className={`flex flex-col ${post.media?.[0] ? 'md:w-1/2' : 'w-full'} min-h-0`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
              <Link to={`/profile/${post.author.username}`} onClick={onClose} className="flex items-center gap-2.5">
                <Avatar user={post.author} size="sm" />
                <span className="text-sm font-semibold">{post.author.profile_name || post.author.username}</span>
              </Link>
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                <IoClose size={20} />
              </button>
            </div>

            {/* Caption */}
            {post.content && (
              <div className="px-4 py-3 border-b border-white/5 flex-shrink-0">
                <p className="text-sm text-white/80 leading-relaxed">
                  <span className="font-semibold text-white mr-1.5">{post.author.username}</span>
                  {post.content}
                </p>
                <p className="text-xs text-white/30 mt-2">{timeAgo(post.created_at)}</p>
              </div>
            )}

            {/* Actions */}
            <div className="px-4 py-3 border-t border-white/5 mt-auto flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-4">
                  <button onClick={toggle} className={`transition-all ${liked ? 'text-red-500' : 'text-white/60 hover:text-white'}`}>
                    {liked ? <IoHeart size={22} /> : <IoHeartOutline size={22} />}
                  </button>
                  <button onClick={() => setShowComments(true)} className="text-white/60 hover:text-white transition-colors">
                    <IoChatbubbleOutline size={21} />
                  </button>
                </div>
                <button onClick={toggleSave} className={`transition-all ${saved ? 'text-violet-400' : 'text-white/60 hover:text-white'}`}>
                  {saved ? <IoBookmark size={21} /> : <IoBookmarkOutline size={21} />}
                </button>
              </div>
              {count > 0 && <p className="text-sm font-semibold">{formatNumber(count)} likes</p>}
              {post.comments_count > 0 && (
                <button onClick={() => setShowComments(true)} className="text-xs text-white/30 hover:text-white/60 mt-0.5">
                  View all {post.comments_count} comments
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      <CommentsDrawer open={showComments} onClose={() => setShowComments(false)} post={post} onUpdate={update} />
    </>
  );
}

EOF_FC62AB51

write_file "frontend/src/components/stories/StoriesBar.jsx" << 'EOF_1E61BFB0'
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoAdd, IoClose, IoChevronBack, IoChevronForward } from 'react-icons/io5';
import { storiesAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';

export default function StoriesBar() {
  const { user }              = useAuth();
  const [groups, setGroups]   = useState([]);
  const [viewer, setViewer]   = useState(null); // { groupIdx, storyIdx }
  const fileRef               = useRef(null);

  useEffect(() => {
    storiesAPI.feed().then(({ data }) => setGroups(data)).catch(() => {});
  }, []);

  const uploadStory = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('media', file);
    try {
      await storiesAPI.create(fd);
      const { data } = await storiesAPI.feed();
      setGroups(data);
    } catch {}
  };

  const openStory = (gIdx) => {
    setViewer({ groupIdx: gIdx, storyIdx: 0 });
    const story = groups[gIdx]?.stories[0];
    if (story) storiesAPI.view(story.id).catch(() => {});
  };

  const next = () => {
    const g = groups[viewer.groupIdx];
    if (viewer.storyIdx < g.stories.length - 1) {
      const next = { ...viewer, storyIdx: viewer.storyIdx + 1 };
      setViewer(next);
      storiesAPI.view(g.stories[next.storyIdx].id).catch(() => {});
    } else if (viewer.groupIdx < groups.length - 1) {
      setViewer({ groupIdx: viewer.groupIdx + 1, storyIdx: 0 });
    } else {
      setViewer(null);
    }
  };

  const prev = () => {
    if (viewer.storyIdx > 0) {
      setViewer({ ...viewer, storyIdx: viewer.storyIdx - 1 });
    } else if (viewer.groupIdx > 0) {
      const prevGroup = groups[viewer.groupIdx - 1];
      setViewer({ groupIdx: viewer.groupIdx - 1, storyIdx: prevGroup.stories.length - 1 });
    }
  };

  const currentStory = viewer ? groups[viewer.groupIdx]?.stories[viewer.storyIdx] : null;
  const currentGroup = viewer ? groups[viewer.groupIdx] : null;

  return (
    <>
      {/* Stories bar */}
      <div className="flex gap-4 overflow-x-auto px-4 py-3 scrollbar-hide">
        {/* Add story */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-14 h-14 rounded-full bg-white/5 border-2 border-dashed border-white/20 hover:border-violet-500 flex items-center justify-center transition-all"
          >
            <IoAdd size={20} className="text-white/50" />
          </button>
          <span className="text-[10px] text-white/40">Your story</span>
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={uploadStory} />
        </div>

        {/* Story groups */}
        {groups.map((g, i) => (
          <button
            key={g.user.id}
            onClick={() => openStory(i)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0"
          >
            <div className={`p-[2px] rounded-full ${g.has_unseen ? 'bg-gradient-to-tr from-violet-500 to-fuchsia-500' : 'bg-white/10'}`}>
              <div className="p-0.5 rounded-full bg-[#0d0d0d]">
                <Avatar user={g.user} size="md" />
              </div>
            </div>
            <span className="text-[10px] text-white/60 truncate w-14 text-center">{g.user.username}</span>
          </button>
        ))}
      </div>

      {/* Story viewer modal */}
      <AnimatePresence>
        {viewer && currentStory && (
          <motion.div
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Progress bar */}
            <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
              {currentGroup.stories.map((_, i) => (
                <div key={i} className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-white rounded-full ${i < viewer.storyIdx ? 'w-full' : i === viewer.storyIdx ? 'animate-story-progress' : 'w-0'}`}
                  />
                </div>
              ))}
            </div>

            {/* Author */}
            <div className="absolute top-10 left-4 flex items-center gap-2 z-10">
              <Avatar user={currentGroup.user} size="sm" ring />
              <span className="text-white text-sm font-semibold">{currentGroup.user.username}</span>
            </div>

            {/* Close */}
            <button onClick={() => setViewer(null)} className="absolute top-4 right-4 z-10 text-white/60 hover:text-white">
              <IoClose size={24} />
            </button>

            {/* Media */}
            {currentStory.media_type === 'video' ? (
              <video
                src={currentStory.media}
                autoPlay
                className="max-h-screen max-w-full object-contain"
                onEnded={next}
              />
            ) : (
              <img
                src={currentStory.media}
                alt=""
                className="max-h-screen max-w-full object-contain"
              />
            )}

            {/* Caption */}
            {currentStory.caption && (
              <div className="absolute bottom-16 left-4 right-4 text-white text-sm text-center bg-black/40 rounded-xl px-4 py-2">
                {currentStory.caption}
              </div>
            )}

            {/* Nav buttons */}
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2">
              <IoChevronBack size={28} />
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2">
              <IoChevronForward size={28} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

EOF_1E61BFB0

write_file "frontend/src/context/AuthContext.jsx" << 'EOF_46674D54'
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem('access');
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await authAPI.me();
      setUser(data);
    } catch {
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (credentials) => {
    const { data } = await authAPI.login(credentials);
    localStorage.setItem('access',  data.access);
    localStorage.setItem('refresh', data.refresh);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await authAPI.register(payload);
    localStorage.setItem('access',  data.access);
    localStorage.setItem('refresh', data.refresh);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    const refresh = localStorage.getItem('refresh');
    try { await authAPI.logout({ refresh }); } catch {}
    localStorage.clear();
    setUser(null);
  };

  const updateUser = (partial) => setUser((u) => ({ ...u, ...partial }));

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, refreshUser: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

EOF_46674D54

write_file "frontend/src/hooks/index.js" << 'EOF_6FBDA650'
import { useState, useCallback, useEffect, useRef } from 'react';
import { postsAPI, usersAPI } from '../api';
import { toast } from 'react-toastify';

// ── Paginated feed loader ────────────────────────────────────
export function usePaginatedFeed(fetcher) {
  const [posts, setPosts]       = useState([]);
  const [page, setPage]         = useState(1);
  const [hasNext, setHasNext]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await fetcher(p);
      if (p === 1) setPosts(data.results);
      else setPosts((prev) => [...prev, ...data.results]);
      setHasNext(data.has_next);
      setPage(p);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => { load(1); }, [load]);

  const loadMore = () => { if (hasNext && !loading) load(page + 1); };

  const updatePost = (id, patch) =>
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));

  const removePost = (id) =>
    setPosts((prev) => prev.filter((p) => p.id !== id));

  return { posts, loading, error, hasNext, loadMore, updatePost, removePost, refresh: () => load(1) };
}

// ── Like toggle ──────────────────────────────────────────────
export function useLike(post, onUpdate) {
  const [liked, setLiked]   = useState(post.is_liked);
  const [count, setCount]   = useState(post.likes_count);
  const pending             = useRef(false);

  const toggle = async () => {
    if (pending.current) return;
    pending.current = true;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => nextLiked ? c + 1 : c - 1);
    try {
      const { data } = await postsAPI.like(post.id);
      setLiked(data.liked);
      setCount(data.likes_count);
      onUpdate?.({ is_liked: data.liked, likes_count: data.likes_count });
    } catch {
      setLiked(!nextLiked);
      setCount((c) => nextLiked ? c - 1 : c + 1);
    } finally {
      pending.current = false;
    }
  };

  return { liked, count, toggle };
}

// ── Save toggle ──────────────────────────────────────────────
export function useSave(post, onUpdate) {
  const [saved, setSaved] = useState(post.is_saved);
  const toggle = async () => {
    const next = !saved;
    setSaved(next);
    try {
      await postsAPI.save(post.id);
      onUpdate?.({ is_saved: next });
    } catch {
      setSaved(!next);
    }
  };
  return { saved, toggle };
}

// ── Follow toggle ─────────────────────────────────────────────
export function useFollow(username, initialFollowing) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading]     = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const { data } = await usersAPI.follow(username);
      setFollowing(data.following);
    } catch {
      toast.error('Failed to update follow status');
    } finally {
      setLoading(false);
    }
  };

  return { following, loading, toggle };
}

// ── Intersection Observer (infinite scroll) ──────────────────
export function useIntersection(callback, options = {}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) callback();
    }, { threshold: 0.1, ...options });
    obs.observe(el);
    return () => obs.disconnect();
  }, [callback]);
  return ref;
}

EOF_6FBDA650

write_file "frontend/src/index.css" << 'EOF_A606A957'
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900;1,9..40,400&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
}

body {
  font-family: 'DM Sans', system-ui, sans-serif;
  background-color: #0d0d0d;
  color: #fff;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Hide scrollbars but keep scrolling */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Thin scrollbar for panels */
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.08);
  border-radius: 4px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.15);
}

/* Story progress animation */
@keyframes story-progress {
  from { width: 0%; }
  to   { width: 100%; }
}
.animate-story-progress {
  animation: story-progress 5s linear forwards;
}

/* Toast overrides */
.Toastify__toast-container {
  z-index: 9999;
}

EOF_A606A957

write_file "frontend/src/main.jsx" << 'EOF_FAF22141'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

EOF_FAF22141

write_file "frontend/src/pages/ExplorePage.jsx" << 'EOF_342E0597'
import { useCallback, useState } from 'react';
import { postsAPI } from '../api';
import { usePaginatedFeed, useIntersection } from '../hooks';
import { Spinner, PostSkeleton } from '../components/common/Loaders';
import { motion, AnimatePresence } from 'framer-motion';
import { IoExpand, IoHeartOutline, IoChatbubbleOutline } from 'react-icons/io5';
import { formatNumber } from '../utils';
import PostDetailModal from '../components/posts/PostDetailModal';

export default function ExplorePage() {
  const fetcher = useCallback((page) => postsAPI.explore(page), []);
  const { posts, loading, hasNext, loadMore } = usePaginatedFeed(fetcher);
  const [selected, setSelected] = useState(null);

  const sentinelRef = useIntersection(() => {
    if (hasNext && !loading) loadMore();
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-6 text-white/90">Explore</h1>

      {loading && posts.length === 0 ? (
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-square bg-white/5 rounded animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-24 text-white/30">
          <p className="text-4xl mb-3">🔭</p>
          <p className="font-medium">Nothing to explore yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 md:gap-1">
          {posts.map((post, i) => (
            <motion.button
              key={post.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: (i % 9) * 0.04 }}
              onClick={() => setSelected(post)}
              className="relative aspect-square group overflow-hidden bg-[#111]"
            >
              {post.media?.[0] ? (
                <img
                  src={post.media[0].file}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5 p-3">
                  <p className="text-white/40 text-xs line-clamp-4 text-left">{post.content}</p>
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-5">
                <span className="flex items-center gap-1.5 text-white font-semibold text-sm">
                  <IoHeartOutline size={18} /> {formatNumber(post.likes_count)}
                </span>
                <span className="flex items-center gap-1.5 text-white font-semibold text-sm">
                  <IoChatbubbleOutline size={16} /> {formatNumber(post.comments_count)}
                </span>
              </div>
              {/* Multi-media indicator */}
              {post.media?.length > 1 && (
                <div className="absolute top-2 right-2">
                  <IoExpand size={14} className="text-white drop-shadow" />
                </div>
              )}
            </motion.button>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="flex justify-center py-6">
        {loading && posts.length > 0 && <Spinner />}
      </div>

      {/* Post detail modal */}
      <AnimatePresence>
        {selected && (
          <PostDetailModal post={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

EOF_342E0597

write_file "frontend/src/pages/HomePage.jsx" << 'EOF_F04D31EA'
import { useCallback } from 'react';
import { postsAPI } from '../api';
import { usePaginatedFeed, useIntersection } from '../hooks';
import PostCard from '../components/posts/PostCard';
import StoriesBar from '../components/stories/StoriesBar';
import RightPanel from '../components/layout/RightPanel';
import { PostSkeleton } from '../components/common/Loaders';
import { Spinner } from '../components/common/Loaders';

export default function HomePage() {
  const fetcher = useCallback((page) => postsAPI.feed(page), []);
  const { posts, loading, hasNext, loadMore, updatePost, removePost } = usePaginatedFeed(fetcher);

  const sentinelRef = useIntersection(() => {
    if (hasNext && !loading) loadMore();
  });

  return (
    <div className="flex justify-center gap-8 max-w-5xl mx-auto px-4 py-6">
      {/* Feed */}
      <div className="w-full max-w-[470px]">
        {/* Stories */}
        <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden mb-4">
          <StoriesBar />
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {loading && posts.length === 0 && (
            Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)
          )}

          {!loading && posts.length === 0 && (
            <div className="text-center py-20 text-white/30">
              <p className="text-4xl mb-3">📭</p>
              <p className="font-medium">Your feed is empty</p>
              <p className="text-sm mt-1">Follow people to see their posts here</p>
            </div>
          )}

          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onUpdate={(patch) => updatePost(post.id, patch)}
              onRemove={removePost}
            />
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="flex justify-center py-4">
            {loading && posts.length > 0 && <Spinner />}
          </div>
        </div>
      </div>

      {/* Right panel - desktop only */}
      <div className="hidden lg:block w-80 flex-shrink-0">
        <div className="sticky top-6">
          <RightPanel />
        </div>
      </div>
    </div>
  );
}

EOF_F04D31EA

write_file "frontend/src/pages/LoginPage.jsx" << 'EOF_39EE03E1'
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/common/Loaders';
import { toast } from 'react-toastify';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]       = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    if (!form.username || !form.password) {
      setErrors({ general: 'Please fill in all fields' });
      return;
    }
    setLoading(true);
    try {
      await login(form);
      navigate('/');
    } catch (err) {
      const data = err.response?.data;
      if (data?.non_field_errors) setErrors({ general: data.non_field_errors[0] });
      else setErrors({ general: 'Invalid username or password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent tracking-tight">
            nexus
          </h1>
          <p className="text-white/30 text-sm mt-2">Connect with your world</p>
        </div>

        {/* Form */}
        <div className="bg-[#111] border border-white/8 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={submit} className="space-y-4">
            {errors.general && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-center"
              >
                {errors.general}
              </motion.p>
            )}

            <div>
              <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">Username</label>
              <input
                value={form.username}
                onChange={set('username')}
                autoComplete="username"
                className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all"
                placeholder="your_username"
              />
            </div>

            <div>
              <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                autoComplete="current-password"
                className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Spinner size="sm" />}
              Log in
            </button>
          </form>
        </div>

        {/* Register link */}
        <div className="mt-4 bg-[#111] border border-white/8 rounded-2xl p-4 text-center">
          <p className="text-sm text-white/40">
            Don't have an account?{' '}
            <Link to="/register" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

EOF_39EE03E1

write_file "frontend/src/pages/MessagesPage.jsx" << 'EOF_86D97031'
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IoChevronBack, IoPaperPlane, IoSearch,
  IoImageOutline, IoEllipsisVertical,
} from 'react-icons/io5';
import { messagesAPI, usersAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/common/Avatar';
import { Spinner } from '../components/common/Loaders';
import { timeAgo } from '../utils';
import { toast } from 'react-toastify';

function ConvItem({ conv, active, onClick, me }) {
  const other = conv.participants.find((p) => p.id !== me?.id) || conv.participants[0];
  const last  = conv.last_message;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left ${
        active ? 'bg-violet-500/12' : 'hover:bg-white/4'
      }`}
    >
      <Avatar user={other} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold truncate">{other?.profile_name || other?.username}</p>
          {last && <p className="text-[11px] text-white/25 flex-shrink-0">{timeAgo(last.created_at)}</p>}
        </div>
        {last && (
          <p className={`text-xs truncate mt-0.5 ${conv.unread_count > 0 ? 'text-white font-medium' : 'text-white/40'}`}>
            {last.sender?.id === me?.id ? 'You: ' : ''}{last.content}
          </p>
        )}
      </div>
      {conv.unread_count > 0 && (
        <span className="flex-shrink-0 bg-violet-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
          {conv.unread_count}
        </span>
      )}
    </button>
  );
}

function ChatPanel({ convId, me, onBack }) {
  const [messages, setMessages] = useState([]);
  const [conv, setConv]         = useState(null);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const bottomRef               = useRef(null);
  const fileRef                 = useRef(null);

  useEffect(() => {
    if (!convId) return;
    setLoading(true);
    messagesAPI.messages(convId).then(({ data }) => {
      setMessages(data.results);
      setLoading(false);
    });
    // Poll for new messages every 5s
    const id = setInterval(() => {
      messagesAPI.messages(convId).then(({ data }) => setMessages(data.results));
    }, 5000);
    return () => clearInterval(id);
  }, [convId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('content', text.trim());
      const { data } = await messagesAPI.send(convId, fd);
      setMessages((m) => [...m, data]);
      setText('');
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const other = conv?.participants?.find((p) => p.id !== me?.id);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 flex-shrink-0">
        <button onClick={onBack} className="md:hidden text-white/50 hover:text-white mr-1">
          <IoChevronBack size={22} />
        </button>
        <Avatar user={other} size="sm" />
        <div>
          <p className="text-sm font-semibold">{other?.profile_name || other?.username}</p>
          <p className="text-xs text-white/30">@{other?.username}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading && <div className="flex justify-center py-8"><Spinner /></div>}
        {messages.map((msg) => {
          const isMe = msg.sender.id === me?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
              {!isMe && <Avatar user={msg.sender} size="xs" className="mt-1 flex-shrink-0" />}
              <div className={`max-w-[72%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isMe
                    ? 'bg-violet-600 text-white rounded-br-sm'
                    : 'bg-white/8 text-white/90 rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
                <p className="text-[10px] text-white/20 px-1">{timeAgo(msg.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="flex items-center gap-2 px-3 py-3 border-t border-white/8 flex-shrink-0">
        <button type="button" onClick={() => fileRef.current?.click()} className="text-white/30 hover:text-white transition-colors flex-shrink-0">
          <IoImageOutline size={20} />
        </button>
        <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
          className="flex-1 bg-white/6 border border-white/8 rounded-xl px-4 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/40 transition-all"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="flex-shrink-0 bg-violet-600 hover:bg-violet-500 disabled:opacity-30 text-white rounded-xl p-2.5 transition-all"
        >
          {sending ? <Spinner size="sm" /> : <IoPaperPlane size={16} />}
        </button>
      </form>
    </div>
  );
}

export default function MessagesPage() {
  const { user }              = useAuth();
  const [convs, setConvs]     = useState([]);
  const [active, setActive]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [newSearch, setNewSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    messagesAPI.conversations().then(({ data }) => {
      setConvs(data);
      setLoading(false);
    });
  }, []);

  const searchUsers = async (q) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await usersAPI.search(q);
    setSearchResults(data);
    setSearching(false);
  };

  const startConv = async (username) => {
    const { data } = await messagesAPI.start(username);
    setConvs((c) => {
      const exists = c.find((x) => x.id === data.id);
      if (!exists) return [data, ...c];
      return c;
    });
    setActive(data.id);
    setNewSearch('');
    setSearchResults([]);
  };

  return (
    <div className="h-[calc(100vh-0px)] flex max-w-4xl mx-auto border-x border-white/5">
      {/* Conversations list */}
      <div className={`${active ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-white/8 flex-shrink-0`}>
        <div className="px-4 py-4 border-b border-white/8">
          <h1 className="text-lg font-bold mb-3">Messages</h1>
          {/* New conversation search */}
          <div className="relative">
            <IoSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={newSearch}
              onChange={(e) => { setNewSearch(e.target.value); searchUsers(e.target.value); }}
              placeholder="New conversation…"
              className="w-full bg-white/6 border border-white/8 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-white/25 outline-none focus:border-violet-500/40 transition-all"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => startConv(u.username)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors"
                >
                  <Avatar user={u} size="sm" />
                  <div className="text-left">
                    <p className="text-xs font-semibold">{u.profile_name || u.username}</p>
                    <p className="text-[11px] text-white/40">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading && <div className="flex justify-center py-8"><Spinner /></div>}
          {!loading && convs.length === 0 && (
            <p className="text-center text-white/25 text-sm py-10">No conversations yet</p>
          )}
          {convs.map((c) => (
            <ConvItem
              key={c.id}
              conv={c}
              active={active === c.id}
              onClick={() => setActive(c.id)}
              me={user}
            />
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div className={`${active ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
        {active ? (
          <ChatPanel convId={active} me={user} onBack={() => setActive(null)} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/20">
            <div className="text-center">
              <p className="text-5xl mb-3">💬</p>
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="text-xs mt-1">or search for someone to message</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

EOF_86D97031

write_file "frontend/src/pages/NotificationsPage.jsx" << 'EOF_5BF4971D'
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { notifsAPI } from '../api';
import Avatar from '../components/common/Avatar';
import { Spinner } from '../components/common/Loaders';
import { timeAgo } from '../utils';

const LABELS = {
  like:    (sender) => <><span className="font-semibold text-white">{sender}</span> liked your post</>,
  comment: (sender) => <><span className="font-semibold text-white">{sender}</span> commented on your post</>,
  follow:  (sender) => <><span className="font-semibold text-white">{sender}</span> started following you</>,
  mention: (sender) => <><span className="font-semibold text-white">{sender}</span> mentioned you</>,
  reply:   (sender) => <><span className="font-semibold text-white">{sender}</span> replied to your comment</>,
};

export default function NotificationsPage() {
  const [notifs, setNotifs]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notifsAPI.list().then(({ data }) => {
      setNotifs(data.results);
      setLoading(false);
      notifsAPI.markRead().catch(() => {});
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-6">Notifications</h1>

      {loading && (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      )}

      {!loading && notifs.length === 0 && (
        <div className="text-center py-20 text-white/30">
          <p className="text-4xl mb-3">🔔</p>
          <p className="font-medium">No notifications yet</p>
        </div>
      )}

      <div className="space-y-1">
        {notifs.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
              !n.is_read ? 'bg-violet-500/8' : 'hover:bg-white/4'
            }`}
          >
            <Link to={`/profile/${n.sender.username}`} className="flex-shrink-0 relative">
              <Avatar user={n.sender} size="md" />
              {!n.is_read && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-violet-500 rounded-full border-2 border-[#0d0d0d]" />
              )}
            </Link>

            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/70 leading-snug">
                {LABELS[n.notif_type]?.(n.sender.profile_name || n.sender.username) ?? n.notif_type}
              </p>
              <p className="text-xs text-white/30 mt-0.5">{timeAgo(n.created_at)}</p>
            </div>

            {n.post?.media?.[0] && (
              <img
                src={n.post.media[0].file}
                alt=""
                className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
              />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

EOF_5BF4971D

write_file "frontend/src/pages/ProfilePage.jsx" << 'EOF_F9A08A25'
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { IoGrid, IoBookmarkOutline, IoPencilOutline, IoClose, IoCamera } from 'react-icons/io5';
import { usersAPI, postsAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useFollow } from '../hooks';
import Avatar from '../components/common/Avatar';
import { Spinner, UserCardSkeleton } from '../components/common/Loaders';
import { formatNumber, timeAgo } from '../utils';
import PostDetailModal from '../components/posts/PostDetailModal';
import Modal from '../components/common/Modal';
import { toast } from 'react-toastify';

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
        active ? 'border-white text-white' : 'border-transparent text-white/30 hover:text-white/60'
      }`}
    >
      <Icon size={15} /> {label}
    </button>
  );
}

function EditProfileModal({ open, onClose, user, onSaved }) {
  const [form, setForm] = useState({
    profile_name: user.profile_name || '',
    bio:          user.bio          || '',
    website:      user.website      || '',
  });
  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleAvatar = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setAvatar(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (avatar) fd.append('profile_picture', avatar);
      const { data } = await usersAPI.update(user.username, fd);
      onSaved(data);
      toast.success('Profile updated!');
      onClose();
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit profile" size="sm">
      <div className="p-5 space-y-5">
        {/* Avatar */}
        <div className="flex justify-center">
          <div className="relative">
            <Avatar user={preview ? { profile_picture: preview } : user} size="xl" />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 bg-violet-600 hover:bg-violet-500 rounded-full p-1.5 transition-colors"
            >
              <IoCamera size={14} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
          </div>
        </div>

        {[
          { k: 'profile_name', label: 'Display name', placeholder: 'Your name' },
          { k: 'bio',          label: 'Bio',          placeholder: 'Tell us about yourself', textarea: true },
          { k: 'website',      label: 'Website',      placeholder: 'https://yoursite.com' },
        ].map(({ k, label, placeholder, textarea }) => (
          <div key={k}>
            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider font-medium">{label}</label>
            {textarea ? (
              <textarea
                value={form[k]}
                onChange={set(k)}
                rows={3}
                placeholder={placeholder}
                className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:border-violet-500/50 resize-none transition-all"
              />
            ) : (
              <input
                value={form[k]}
                onChange={set(k)}
                placeholder={placeholder}
                className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:border-violet-500/50 transition-all"
              />
            )}
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Spinner size="sm" />} Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

function FollowListModal({ open, onClose, title, username, type }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const fn = type === 'followers' ? usersAPI.followers : usersAPI.following;
    fn(username).then(({ data }) => { setUsers(data); setLoading(false); }).catch(() => setLoading(false));
  }, [open, username, type]);

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
        {loading && (
          <div className="p-4 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <UserCardSkeleton key={i} />)}
          </div>
        )}
        {!loading && users.map((u) => (
          <div key={u.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar user={u} size="sm" />
              <div>
                <p className="text-sm font-semibold">{u.profile_name || u.username}</p>
                <p className="text-xs text-white/40">@{u.username}</p>
              </div>
            </div>
          </div>
        ))}
        {!loading && users.length === 0 && (
          <p className="text-center text-white/30 text-sm py-8">None yet</p>
        )}
      </div>
    </Modal>
  );
}

export default function ProfilePage() {
  const { username }         = useParams();
  const { user: me, updateUser } = useAuth();
  const navigate             = useNavigate();
  const [profile, setProfile]   = useState(null);
  const [posts, setPosts]       = useState([]);
  const [saved, setSaved]       = useState([]);
  const [tab, setTab]           = useState('posts');
  const [selected, setSelected] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [followModal, setFollowModal] = useState(null); // 'followers' | 'following'
  const [loading, setLoading]   = useState(true);

  const isMe = me?.username === username;

  useEffect(() => {
    setLoading(true);
    setProfile(null);
    setPosts([]);
    usersAPI.profile(username)
      .then(({ data }) => { setProfile(data); setLoading(false); })
      .catch(() => { navigate('/'); });
    postsAPI.userPosts(username).then(({ data }) => setPosts(data)).catch(() => {});
  }, [username]);

  useEffect(() => {
    if (isMe && tab === 'saved') {
      postsAPI.saved().then(({ data }) => setSaved(data)).catch(() => {});
    }
  }, [tab, isMe]);

  const { following, loading: followLoading, toggle: toggleFollow } =
    useFollow(username, profile?.is_following);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!profile) return null;

  const displayPosts = tab === 'saved' ? saved : posts;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Profile header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8 mb-10">
        <Avatar user={profile} size="2xl" />

        <div className="flex-1">
          {/* Name row */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h1 className="text-xl font-bold">{profile.username}</h1>
            {isMe ? (
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-white/8 hover:bg-white/12 rounded-lg text-sm font-medium transition-all"
              >
                <IoPencilOutline size={14} /> Edit profile
              </button>
            ) : (
              <button
                onClick={toggleFollow}
                disabled={followLoading}
                className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  following
                    ? 'bg-white/8 hover:bg-red-500/20 hover:text-red-400 text-white'
                    : 'bg-violet-600 hover:bg-violet-500 text-white'
                }`}
              >
                {followLoading ? <Spinner size="sm" /> : following ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-6 mb-4">
            {[
              { label: 'posts',     val: profile.posts_count },
              { label: 'followers', val: profile.followers_count, onClick: () => setFollowModal('followers') },
              { label: 'following', val: profile.following_count, onClick: () => setFollowModal('following') },
            ].map(({ label, val, onClick }) => (
              <button key={label} onClick={onClick} className="text-center hover:opacity-80 transition-opacity" disabled={!onClick}>
                <p className="font-bold text-white">{formatNumber(val)}</p>
                <p className="text-sm text-white/50">{label}</p>
              </button>
            ))}
          </div>

          {/* Bio */}
          {profile.profile_name && <p className="font-semibold text-sm">{profile.profile_name}</p>}
          {profile.bio && <p className="text-sm text-white/60 mt-1 leading-relaxed">{profile.bio}</p>}
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-400 hover:underline mt-1 block">
              {profile.website}
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-t border-white/8 flex justify-center gap-8 mb-4">
        <TabButton active={tab === 'posts'} onClick={() => setTab('posts')} icon={IoGrid} label="Posts" />
        {isMe && <TabButton active={tab === 'saved'} onClick={() => setTab('saved')} icon={IoBookmarkOutline} label="Saved" />}
      </div>

      {/* Grid */}
      {displayPosts.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <p className="text-4xl mb-3">{tab === 'saved' ? '🔖' : '📷'}</p>
          <p className="font-medium">{tab === 'saved' ? 'No saved posts' : 'No posts yet'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5">
          {displayPosts.map((post, i) => (
            <motion.button
              key={post.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setSelected(post)}
              className="relative aspect-square group overflow-hidden bg-[#111]"
            >
              {post.media?.[0] ? (
                <img src={post.media[0].file} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5 p-3">
                  <p className="text-white/40 text-xs line-clamp-4 text-left">{post.content}</p>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          ))}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {selected && <PostDetailModal post={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>

      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        user={profile}
        onSaved={(data) => { setProfile(data); if (isMe) updateUser(data); }}
      />

      <FollowListModal
        open={!!followModal}
        onClose={() => setFollowModal(null)}
        title={followModal === 'followers' ? 'Followers' : 'Following'}
        username={username}
        type={followModal}
      />
    </div>
  );
}

EOF_F9A08A25

write_file "frontend/src/pages/ReelsPage.jsx" << 'EOF_7BD98DD9'
import { IoFilm } from 'react-icons/io5';

export default function ReelsPage() {
  return (
    <div className="flex items-center justify-center min-h-screen text-white/20">
      <div className="text-center">
        <IoFilm size={48} className="mx-auto mb-4 opacity-30" />
        <p className="font-semibold text-lg">Reels</p>
        <p className="text-sm mt-1">Coming soon — add video Stories to get started</p>
      </div>
    </div>
  );
}

EOF_7BD98DD9

write_file "frontend/src/pages/RegisterPage.jsx" << 'EOF_6AB93827'
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/common/Loaders';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate     = useNavigate();
  const [form, setForm]       = useState({ username: '', email: '', profile_name: '', password: '', password2: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    if (form.password !== form.password2) {
      setErrors({ password2: 'Passwords do not match' });
      return;
    }
    setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      const data = err.response?.data || {};
      setErrors(data);
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: 'username',     label: 'Username',      type: 'text',     placeholder: 'john_doe'      },
    { key: 'profile_name', label: 'Display name',  type: 'text',     placeholder: 'John Doe'      },
    { key: 'email',        label: 'Email',         type: 'email',    placeholder: 'you@email.com'  },
    { key: 'password',     label: 'Password',      type: 'password', placeholder: '8+ characters'  },
    { key: 'password2',    label: 'Confirm password', type: 'password', placeholder: 'Repeat password' },
  ];

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4 py-10">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-fuchsia-600/8 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent tracking-tight">
            nexus
          </h1>
          <p className="text-white/30 text-sm mt-2">Create your account</p>
        </div>

        <div className="bg-[#111] border border-white/8 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={submit} className="space-y-3.5">
            {fields.map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={set(key)}
                  placeholder={placeholder}
                  className={`
                    w-full bg-white/5 border rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 outline-none transition-all
                    ${errors[key] ? 'border-red-500/50 bg-red-500/5' : 'border-white/8 focus:border-violet-500/50 focus:bg-white/8'}
                  `}
                />
                {errors[key] && (
                  <p className="text-xs text-red-400 mt-1">{Array.isArray(errors[key]) ? errors[key][0] : errors[key]}</p>
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
            >
              {loading && <Spinner size="sm" />}
              Create account
            </button>
          </form>
        </div>

        <div className="mt-4 bg-[#111] border border-white/8 rounded-2xl p-4 text-center">
          <p className="text-sm text-white/40">
            Already have an account?{' '}
            <Link to="/login" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">
              Log in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

EOF_6AB93827

write_file "frontend/src/pages/SearchPage.jsx" << 'EOF_E8F1021F'
import { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { IoSearch, IoClose } from 'react-icons/io5';
import { usersAPI, postsAPI } from '../api';
import Avatar from '../components/common/Avatar';
import { Spinner } from '../components/common/Loaders';
import { useFollow } from '../hooks';
import { useAuth } from '../context/AuthContext';

function UserResult({ user }) {
  const { user: me } = useAuth();
  const { following, toggle } = useFollow(user.username, user.is_following);
  const isMe = me?.id === user.id;

  return (
    <div className="flex items-center justify-between px-1 py-2.5">
      <Link to={`/profile/${user.username}`} className="flex items-center gap-3 group flex-1 min-w-0">
        <Avatar user={user} size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white group-hover:text-violet-400 transition-colors truncate">
            {user.profile_name || user.username}
          </p>
          <p className="text-xs text-white/40 truncate">@{user.username}</p>
        </div>
      </Link>
      {!isMe && (
        <button
          onClick={toggle}
          className={`ml-3 flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            following ? 'bg-white/8 text-white hover:bg-white/12' : 'bg-violet-600 text-white hover:bg-violet-500'
          }`}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}

export default function SearchPage() {
  const [query, setQuery]         = useState('');
  const [tab, setTab]             = useState('users');
  const [users, setUsers]         = useState([]);
  const [posts, setPosts]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [searched, setSearched]   = useState(false);
  const debounceRef               = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setUsers([]); setPosts([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    try {
      const [uRes, pRes] = await Promise.all([
        usersAPI.search(q),
        postsAPI.search(q),
      ]);
      setUsers(uRes.data);
      setPosts(pRes.data);
    } catch {}
    setLoading(false);
  }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 400);
  };

  const clear = () => { setQuery(''); setUsers([]); setPosts([]); setSearched(false); };

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-5">Search</h1>

      {/* Search input */}
      <div className="relative mb-5">
        <IoSearch size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={query}
          onChange={handleChange}
          placeholder="Search people, posts…"
          autoFocus
          className="w-full bg-white/6 border border-white/8 rounded-2xl pl-10 pr-10 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50 transition-all"
        />
        {query && (
          <button onClick={clear} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
            <IoClose size={16} />
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-10"><Spinner /></div>
      )}

      {!loading && searched && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-white/5 rounded-xl p-1">
            {['users', 'posts'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                  tab === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
                }`}
              >
                {t} {t === 'users' ? `(${users.length})` : `(${posts.length})`}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === 'users' && (
              <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {users.length === 0
                  ? <p className="text-center text-white/30 py-8 text-sm">No users found for "{query}"</p>
                  : <div className="divide-y divide-white/5">{users.map((u) => <UserResult key={u.id} user={u} />)}</div>
                }
              </motion.div>
            )}
            {tab === 'posts' && (
              <motion.div key="posts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {posts.length === 0
                  ? <p className="text-center text-white/30 py-8 text-sm">No posts found for "{query}"</p>
                  : (
                    <div className="grid grid-cols-3 gap-0.5">
                      {posts.map((p) => (
                        <Link key={p.id} to={`/post/${p.id}`} className="aspect-square bg-[#111] overflow-hidden group">
                          {p.media?.[0]
                            ? <img src={p.media[0].file} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            : <div className="w-full h-full flex items-center justify-center p-3"><p className="text-white/40 text-xs line-clamp-4">{p.content}</p></div>
                          }
                        </Link>
                      ))}
                    </div>
                  )
                }
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {!searched && !loading && (
        <div className="text-center py-16 text-white/20">
          <IoSearch size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Search for people or posts</p>
        </div>
      )}
    </div>
  );
}

EOF_E8F1021F

write_file "frontend/src/utils/index.js" << 'EOF_90A6729E'
import { formatDistanceToNow, format } from 'date-fns';

export const timeAgo = (date) =>
  formatDistanceToNow(new Date(date), { addSuffix: true });

export const formatDate = (date) =>
  format(new Date(date), 'MMM d, yyyy');

export const formatNumber = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

export const getInitials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

export const avatarUrl = (user) =>
  user?.profile_picture || null;

export const classNames = (...classes) =>
  classes.filter(Boolean).join(' ');

EOF_90A6729E

write_file "frontend/tailwind.config.js" << 'EOF_5075306D'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f3eeff',
          100: '#e2d5ff',
          200: '#c4aaff',
          300: '#a57eff',
          400: '#8b5cf6',
          500: '#7c3aed',
          600: '#6d28d9',
          700: '#5b21b6',
          800: '#4c1d95',
          900: '#3b1578',
        },
      },
      animation: {
        'story-progress': 'story-progress 5s linear forwards',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 },          to: { opacity: 1 } },
        slideUp: { from: { transform: 'translateY(20px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

EOF_5075306D

write_file "frontend/vite.config.js" << 'EOF_1DF094A1'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://django:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://django:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});

EOF_1DF094A1


# ── Post-injection steps ─────────────────────────────────────
echo ""
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅  All 51 files injected successfully!"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Add to backend/requirements.txt:"
echo "       djangorestframework"
echo "       djangorestframework-simplejwt"
echo "       django-cors-headers"
echo ""
echo "  2. Apply backend/SETTINGS_ADDITIONS.py into your settings.py"
echo ""
echo "  3. Run migrations:"
echo "       cd '$PROJECT_ROOT'"
echo "       docker compose run --rm django python manage.py makemigrations"
echo "       docker compose run --rm django python manage.py migrate"
echo ""
echo "  4. Start dev:"
echo "       docker compose --profile dev up"
echo ""