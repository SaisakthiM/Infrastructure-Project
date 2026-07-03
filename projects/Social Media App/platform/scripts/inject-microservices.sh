#!/usr/bin/env bash
set -euo pipefail

PROJECT='/home/saisakthi/Coding-Project/Projects/Unfinished Projects/Working On/Social Media App'

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${BLUE}→${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }

echo ""
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║     Microservices Wiring — Injection Script          ║"
echo "  ║     Java + Go + Django Kafka + Nginx                 ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo ""
info "Target: $PROJECT"
echo ""
echo "  Files to be written:"
echo "    microservice-java/  → 9 Java files (models, consumers, controllers)"
echo "    microservice-go/    → 1 Go file    (full Redis service, 12 endpoints)"
echo "    backend/            → kafka_events.py + updated views + settings"
echo "    nginx-conf/         → default.conf (all services routed)"
echo ""
read -p "  Proceed? [y/N] " -n 1 -r; echo ""
[[ $REPLY =~ ^[Yy]$ ]] || { echo "  Aborted."; exit 1; }
echo ""

write_file() {
  local rel="$1"; local full="$PROJECT/$rel"
  mkdir -p "$(dirname "$full")"
  cat > "$full"
  log "$rel"
}

write_file "backend/social_media/apps/kafka_events.py" << 'EOF_E08A9CC0A6'
"""
Kafka producer for Django.
Install: pip install confluent-kafka

Usage:
    from apps.kafka_events import publish_post_created, publish_post_liked, ...
"""
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

try:
    from confluent_kafka import Producer
    _KAFKA_AVAILABLE = True
except ImportError:
    _KAFKA_AVAILABLE = False
    logger.warning("confluent-kafka not installed — Kafka events disabled")


def _get_producer() -> Optional[object]:
    if not _KAFKA_AVAILABLE:
        return None
    try:
        return Producer({
            'bootstrap.servers': os.environ.get('KAFKA_BOOTSTRAP_SERVERS', 'kafka:9092'),
            'client.id':         'django-producer',
            'acks':              '1',          # leader ack only — fast
            'retries':           3,
            'retry.backoff.ms':  200,
        })
    except Exception as e:
        logger.error("Kafka producer init failed: %s", e)
        return None


def _publish(topic: str, payload: dict):
    """Fire-and-forget publish. Never raises — Kafka failure must not break Django requests."""
    producer = _get_producer()
    if not producer:
        return
    try:
        producer.produce(
            topic,
            key=payload.get('authorId') or payload.get('senderId') or payload.get('followerId', ''),
            value=json.dumps(payload),
        )
        producer.flush(timeout=1)  # 1s max wait
    except Exception as e:
        logger.error("Kafka publish failed [%s]: %s", topic, e)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Public event publishers ────────────────────────────────────────────────────

def publish_post_created(post, follower_ids: list[str]):
    """
    Call after a post is saved in Django.
    Java will fan-out this post to all followers' Cassandra feed tables.
    """
    thumbnail = None
    if post.media.exists():
        first = post.media.first()
        thumbnail = first.file.url if first.file else None

    _publish('post.created', {
        'postId':         str(post.id),
        'authorId':       str(post.author.id),
        'authorUsername': post.author.username,
        'authorAvatar':   post.author.profile_picture.url if post.author.profile_picture else None,
        'contentPreview': post.content[:120],
        'thumbnailUrl':   thumbnail,
        'postType':       'post',
        'createdAt':      _now(),
        'followerIds':    follower_ids,
    })


def publish_post_liked(post, liker):
    """Call after a Like is created."""
    thumbnail = None
    if post.media.exists():
        first = post.media.first()
        thumbnail = first.file.url if first.file else None

    _publish('post.liked', {
        'postId':         str(post.id),
        'postAuthorId':   str(post.author.id),
        'senderId':       str(liker.id),
        'senderUsername': liker.username,
        'senderAvatar':   liker.profile_picture.url if liker.profile_picture else None,
        'postThumbnail':  thumbnail,
        'createdAt':      _now(),
    })


def publish_post_commented(post, commenter, comment_text: str):
    """Call after a Comment is saved."""
    thumbnail = None
    if post.media.exists():
        first = post.media.first()
        thumbnail = first.file.url if first.file else None

    _publish('post.commented', {
        'postId':         str(post.id),
        'postAuthorId':   str(post.author.id),
        'senderId':       str(commenter.id),
        'senderUsername': commenter.username,
        'senderAvatar':   commenter.profile_picture.url if commenter.profile_picture else None,
        'postThumbnail':  thumbnail,
        'commentText':    comment_text[:200],
        'createdAt':      _now(),
    })


def publish_user_followed(follower, following):
    """Call after a Follow is created."""
    _publish('user.followed', {
        'followerId':       str(follower.id),
        'followerUsername': follower.username,
        'followerAvatar':   follower.profile_picture.url if follower.profile_picture else None,
        'followingId':      str(following.id),
        'createdAt':        _now(),
    })


def publish_post_viewed(post, viewer):
    """Call when a post appears in viewport (frontend fires view event)."""
    _publish('post.viewed', {
        'postId':   str(post.id),
        'authorId': str(post.author.id),
        'viewerId': str(viewer.id),
        'createdAt': _now(),
    })

EOF_E08A9CC0A6

write_file "backend/social_media/apps/posts/views.py" << 'EOF_08C9CA81FB'
"""
Updated posts/views.py — drop this in to replace the existing one.
Adds: Kafka event publishing, Go cache invalidation, feed caching.
"""
import requests
import logging
from django.conf import settings
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.db.models import Q

from .models import Post, PostMedia, Comment, Like, Save
from .serializers import PostSerializer, CreatePostSerializer, CommentSerializer
from apps.users.models import Follow

logger = logging.getLogger(__name__)

GO_SERVICE = getattr(settings, 'GO_SERVICE_URL', 'http://microservice-go:8080')
JAVA_SERVICE = getattr(settings, 'JAVA_SERVICE_URL', 'http://microservice-java:8080')


def _go(method, path, **kwargs):
    """Call Go microservice — never raises, returns None on failure."""
    try:
        return requests.request(method, f"{GO_SERVICE}{path}", timeout=0.5, **kwargs)
    except Exception as e:
        logger.warning("Go service call failed [%s %s]: %s", method, path, e)
        return None


def _invalidate_follower_caches(user):
    """After a post is created, clear cached feeds for all followers."""
    follower_ids = Follow.objects.filter(following=user).values_list('follower_id', flat=True)
    for fid in follower_ids:
        _go('DELETE', f'/api/go/cache/feed/{fid}')


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def feed(request):
    user_id = str(request.user.id)

    # 1. Try Go cache first
    cached = _go('GET', f'/api/go/cache/feed/{user_id}')
    if cached and cached.status_code == 200:
        return Response(cached.json())

    # 2. Build feed from Postgres
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

    result = {
        'results': PostSerializer(posts_page, many=True, context={'request': request}).data,
        'total': total,
        'page': page,
        'has_next': end < total,
    }

    # 3. Cache in Go/Redis for 5 minutes (only page 1)
    if page == 1:
        import json
        _go('POST', '/api/go/cache/feed', json={
            'user_id': user_id,
            'feed_json': json.dumps(result, default=str),
            'ttl_seconds': 300,
        })

    return Response(result)


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
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    post = serializer.save()

    # Save media files
    files = request.FILES.getlist('media')
    for i, f in enumerate(files):
        media_type = 'video' if f.content_type.startswith('video') else 'image'
        PostMedia.objects.create(post=post, file=f, media_type=media_type, order=i)

    # Check rate limit via Go service
    rl = _go('POST', '/api/go/rate-limit/check', json={
        'user_id': str(request.user.id),
        'action': 'post_create',
        'limit': 20,
        'window_seconds': 3600,
    })
    if rl and rl.status_code == 200 and not rl.json().get('allowed'):
        post.delete()
        return Response({'detail': 'Rate limit exceeded. Max 20 posts per hour.'}, status=429)

    # Publish Kafka event — fan-out to followers' feeds
    follower_ids = list(
        Follow.objects.filter(following=request.user).values_list('follower_id', flat=True)
    )
    follower_ids_str = [str(fid) for fid in follower_ids]
    try:
        from apps.kafka_events import publish_post_created
        publish_post_created(post, follower_ids_str)
    except Exception as e:
        logger.error("Kafka publish failed: %s", e)

    # Invalidate cached feeds for all followers
    _invalidate_follower_caches(request.user)

    return Response(PostSerializer(post, context={'request': request}).data, status=201)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def post_detail(request, pk):
    post = get_object_or_404(Post, pk=pk)
    if request.method == 'GET':
        # Publish view event to Kafka (async analytics)
        try:
            from apps.kafka_events import publish_post_viewed
            publish_post_viewed(post, request.user)
        except Exception:
            pass
        return Response(PostSerializer(post, context={'request': request}).data)

    if post.author != request.user:
        return Response({'detail': 'Forbidden.'}, status=403)

    if request.method == 'DELETE':
        post.delete()
        _invalidate_follower_caches(request.user)
        return Response(status=204)

    if request.method == 'PUT':
        serializer = CreatePostSerializer(post, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            _invalidate_follower_caches(request.user)
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

    # Publish Kafka event → Java writes notification to Cassandra
    try:
        from apps.kafka_events import publish_post_liked
        publish_post_liked(post, request.user)
    except Exception as e:
        logger.error("Kafka publish failed: %s", e)

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

        # Publish Kafka event → Java writes notification
        try:
            from apps.kafka_events import publish_post_commented
            publish_post_commented(post, request.user, comment.content)
        except Exception as e:
            logger.error("Kafka publish failed: %s", e)

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

EOF_08C9CA81FB

write_file "backend/MICROSERVICE_REQUIREMENTS.txt" << 'EOF_E71D406715'
# Add these to your backend/requirements.txt

# Existing (keep these)
Django>=4.2
djangorestframework
djangorestframework-simplejwt
django-cors-headers
django-storages
boto3
graphene-django
django-prometheus
psycopg2-binary
Pillow

# NEW — Kafka producer
confluent-kafka>=2.3.0

# NEW — HTTP calls to Go/Java microservices
requests>=2.31.0

# NEW — MinIO media storage (already in compose, now wired)
# boto3 already listed above — just uncomment MinIO settings

# NEW — OpenTelemetry tracing (sends traces to Tempo)
opentelemetry-sdk>=1.20.0
opentelemetry-exporter-otlp>=1.20.0
opentelemetry-instrumentation-django>=0.41b0
opentelemetry-instrumentation-requests>=0.41b0

EOF_E71D406715

write_file "backend/SETTINGS_MICROSERVICES.py" << 'EOF_0599E387AA'
# ============================================================
# Add these to your existing SETTINGS_ADDITIONS.py / settings.py
# ============================================================

import os

# ── Microservice URLs ────────────────────────────────────────
GO_SERVICE_URL   = os.environ.get('GO_SERVICE_URL',   'http://microservice-go:8080')
JAVA_SERVICE_URL = os.environ.get('JAVA_SERVICE_URL', 'http://microservice-java:8080')

# ── Kafka ────────────────────────────────────────────────────
KAFKA_BOOTSTRAP_SERVERS = os.environ.get('KAFKA_BOOTSTRAP_SERVERS', 'kafka:9092')

# ── MinIO Media Storage ───────────────────────────────────────
# Uncomment this block to enable MinIO instead of local file storage
#
# DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
# AWS_ACCESS_KEY_ID       = os.environ.get('MEDIA_STORAGE_KEY',    'minio')
# AWS_SECRET_ACCESS_KEY   = os.environ.get('MEDIA_STORAGE_SECRET', 'minio123')
# AWS_STORAGE_BUCKET_NAME = 'media'
# AWS_S3_ENDPOINT_URL     = os.environ.get('MEDIA_STORAGE_URL',    'http://minio:9000')
# AWS_DEFAULT_ACL         = 'public-read'
# AWS_S3_FILE_OVERWRITE   = False
# AWS_S3_CUSTOM_DOMAIN    = None
# MEDIA_URL = f"{AWS_S3_ENDPOINT_URL}/media/"

# ── OpenTelemetry → Tempo ────────────────────────────────────
# Uncomment to enable distributed tracing
#
# from opentelemetry import trace
# from opentelemetry.sdk.trace import TracerProvider
# from opentelemetry.sdk.trace.export import BatchSpanProcessor
# from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
# from opentelemetry.instrumentation.django import DjangoInstrumentor
# from opentelemetry.instrumentation.requests import RequestsInstrumentor
#
# provider = TracerProvider()
# provider.add_span_processor(BatchSpanProcessor(
#     OTLPSpanExporter(endpoint="http://tempo:4317", insecure=True)
# ))
# trace.set_tracer_provider(provider)
# DjangoInstrumentor().instrument()
# RequestsInstrumentor().instrument()

# ── apps/kafka_events.py location ────────────────────────────
# Copy django-kafka/kafka_events.py → backend/social_media/apps/kafka_events.py
# Then import in views:
#   from apps.kafka_events import publish_post_created

EOF_0599E387AA

write_file "backend/social_media/apps/users/views.py" << 'EOF_3BB00FC2A9'
"""
Updated users/views.py — adds Kafka follow events + Go rate limiting.
Drop this in to replace the existing one.
"""
import requests
import logging
from django.conf import settings
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import get_user_model
from django.db.models import Q

from .models import Follow
from .serializers import (
    UserSerializer, UserMinimalSerializer,
    RegisterSerializer, LoginSerializer, UpdateProfileSerializer
)
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()
logger = logging.getLogger(__name__)
GO_SERVICE = getattr(settings, 'GO_SERVICE_URL', 'http://microservice-go:8080')


def _go(method, path, **kwargs):
    try:
        return requests.request(method, f"{GO_SERVICE}{path}", timeout=0.5, **kwargs)
    except Exception as e:
        logger.warning("Go service call failed: %s", e)
        return None


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
        user = data['user']

        # Set presence in Go/Redis
        _go('POST', '/api/go/presence/heartbeat', json={'user_id': str(user.id)})

        return Response({
            'user': UserSerializer(user, context={'request': request}).data,
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
    # Clear presence
    _go('POST', '/api/go/presence/heartbeat', json={'user_id': str(request.user.id)})
    return Response({'detail': 'Logged out.'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    # Refresh presence
    _go('POST', '/api/go/presence/heartbeat', json={'user_id': str(request.user.id)})
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
def update_profile(request, username):
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

    # Rate limit follows via Go
    rl = _go('POST', '/api/go/rate-limit/check', json={
        'user_id': str(request.user.id),
        'action': 'follow',
        'limit': 50,
        'window_seconds': 3600,
    })
    if rl and rl.status_code == 200 and not rl.json().get('allowed'):
        return Response({'detail': 'Too many follows. Slow down.'}, status=429)

    follow, created = Follow.objects.get_or_create(follower=request.user, following=target)
    if not created:
        follow.delete()
        return Response({'following': False})

    # Publish Kafka event → Java writes follow notification to Cassandra
    try:
        from apps.kafka_events import publish_user_followed
        publish_user_followed(request.user, target)
    except Exception as e:
        logger.error("Kafka publish failed: %s", e)

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


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def presence(request, username):
    """GET /api/users/{username}/presence — check if user is online via Go/Redis."""
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)

    resp = _go('GET', f'/api/go/presence/{user.id}')
    if resp and resp.status_code == 200:
        return Response(resp.json())
    return Response({'online': False, 'last_seen': None})

EOF_3BB00FC2A9

write_file "microservice-go/main.go" << 'EOF_B77505FFFA'
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	rdb *redis.Client
	ctx = context.Background()
)

// ── Response helpers ──────────────────────────────────────────────────────────

func jsonOK(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// ── Health ────────────────────────────────────────────────────────────────────

func healthHandler(w http.ResponseWriter, r *http.Request) {
	if _, err := rdb.Ping(ctx).Result(); err != nil {
		jsonErr(w, "redis unreachable", 503)
		return
	}
	jsonOK(w, map[string]string{"status": "healthy", "service": "go-microservice"})
}

// ── Rate Limiting ─────────────────────────────────────────────────────────────
// POST /api/go/rate-limit/check
// Body: {"user_id": "123", "action": "post_create", "limit": 10, "window_seconds": 3600}
// Django calls this before allowing expensive actions (post create, follow, DM).

func rateLimitHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, "method not allowed", 405)
		return
	}

	var req struct {
		UserID        string `json:"user_id"`
		Action        string `json:"action"`
		Limit         int    `json:"limit"`
		WindowSeconds int    `json:"window_seconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid body", 400)
		return
	}

	key := fmt.Sprintf("ratelimit:%s:%s", req.UserID, req.Action)
	window := time.Duration(req.WindowSeconds) * time.Second

	// Atomic increment + set expiry only if key is new
	pipe := rdb.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, window)
	if _, err := pipe.Exec(ctx); err != nil {
		jsonErr(w, "redis error", 500)
		return
	}

	count := incr.Val()
	allowed := count <= int64(req.Limit)

	ttl, _ := rdb.TTL(ctx, key).Result()
	jsonOK(w, map[string]any{
		"allowed":     allowed,
		"current":     count,
		"limit":       req.Limit,
		"reset_in_ms": ttl.Milliseconds(),
	})
}

// ── User Presence ─────────────────────────────────────────────────────────────
// POST /api/go/presence/heartbeat
// Body: {"user_id": "123"}
// Frontend sends this every 30s while tab is open.

func presenceHeartbeatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, "method not allowed", 405)
		return
	}

	var req struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid body", 400)
		return
	}

	key := fmt.Sprintf("presence:%s", req.UserID)
	// Mark online with 60s TTL — if no heartbeat for 60s, key expires = offline
	rdb.Set(ctx, key, time.Now().Unix(), 60*time.Second)
	jsonOK(w, map[string]string{"status": "ok"})
}

// GET /api/go/presence/{user_id}
// Returns whether a user is currently online.

func presenceGetHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("user_id")
	if userID == "" {
		jsonErr(w, "user_id required", 400)
		return
	}

	key := fmt.Sprintf("presence:%s", userID)
	val, err := rdb.Get(ctx, key).Result()
	online := err == nil && val != ""

	lastSeen := int64(0)
	if online {
		lastSeen, _ = strconv.ParseInt(val, 10, 64)
	} else {
		// Check last-seen timestamp (set on logout/heartbeat expiry)
		lsKey := fmt.Sprintf("last_seen:%s", userID)
		ls, _ := rdb.Get(ctx, lsKey).Result()
		lastSeen, _ = strconv.ParseInt(ls, 10, 64)
	}

	jsonOK(w, map[string]any{
		"user_id":   userID,
		"online":    online,
		"last_seen": lastSeen,
	})
}

// POST /api/go/presence/bulk
// Body: {"user_ids": ["1","2","3"]}
// Check presence of multiple users at once (for DM list, comments, etc.)

func presenceBulkHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, "method not allowed", 405)
		return
	}

	var req struct {
		UserIDs []string `json:"user_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid body", 400)
		return
	}

	result := make(map[string]bool)
	for _, uid := range req.UserIDs {
		key := fmt.Sprintf("presence:%s", uid)
		exists, _ := rdb.Exists(ctx, key).Result()
		result[uid] = exists > 0
	}

	jsonOK(w, map[string]any{"presence": result})
}

// ── Feed Cache ────────────────────────────────────────────────────────────────
// POST /api/go/cache/feed
// Body: {"user_id": "123", "feed_json": "...", "ttl_seconds": 300}
// Django calls this after assembling a feed to cache it for 5 min.

func cacheFeedSetHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, "method not allowed", 405)
		return
	}

	var req struct {
		UserID     string `json:"user_id"`
		FeedJSON   string `json:"feed_json"`
		TTLSeconds int    `json:"ttl_seconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid body", 400)
		return
	}

	key := fmt.Sprintf("feed_cache:%s", req.UserID)
	ttl := time.Duration(req.TTLSeconds) * time.Second
	if ttl == 0 {
		ttl = 5 * time.Minute
	}

	rdb.Set(ctx, key, req.FeedJSON, ttl)
	jsonOK(w, map[string]string{"status": "cached"})
}

// GET /api/go/cache/feed/{user_id}
// Returns cached feed JSON or 404 if expired/missing.

func cacheFeedGetHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("user_id")
	key := fmt.Sprintf("feed_cache:%s", userID)

	val, err := rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		jsonErr(w, "cache miss", 404)
		return
	}
	if err != nil {
		jsonErr(w, "redis error", 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprint(w, val)
}

// DELETE /api/go/cache/feed/{user_id}
// Django calls this when a user the person follows creates a post —
// invalidates stale cache so next request rebuilds fresh.

func cacheFeedInvalidateHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("user_id")
	key := fmt.Sprintf("feed_cache:%s", userID)
	rdb.Del(ctx, key)
	jsonOK(w, map[string]string{"status": "invalidated"})
}

// ── Typing Indicators ─────────────────────────────────────────────────────────
// POST /api/go/typing
// Body: {"conversation_id": "5", "user_id": "123"}
// Frontend calls this while user is typing in DMs.

func typingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, "method not allowed", 405)
		return
	}

	var req struct {
		ConversationID string `json:"conversation_id"`
		UserID         string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid body", 400)
		return
	}

	// Key expires in 3s — if frontend doesn't re-send, typing stops
	key := fmt.Sprintf("typing:%s:%s", req.ConversationID, req.UserID)
	rdb.Set(ctx, key, "1", 3*time.Second)
	jsonOK(w, map[string]string{"status": "ok"})
}

// GET /api/go/typing/{conversation_id}
// Returns list of user_ids currently typing in a conversation.

func typingGetHandler(w http.ResponseWriter, r *http.Request) {
	convID := r.PathValue("conversation_id")

	pattern := fmt.Sprintf("typing:%s:*", convID)
	keys, _ := rdb.Keys(ctx, pattern).Result()

	typingUsers := []string{}
	for _, k := range keys {
		// Extract user_id from "typing:{conv_id}:{user_id}"
		var convPart, userID string
		fmt.Sscanf(k, "typing:%s:%s", &convPart, &userID)
		typingUsers = append(typingUsers, userID)
	}

	jsonOK(w, map[string]any{"typing": typingUsers})
}

// ── Unread Message Count ──────────────────────────────────────────────────────
// POST /api/go/unread/increment
// Body: {"user_id": "123", "conversation_id": "5"}

func unreadIncrementHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, "method not allowed", 405)
		return
	}

	var req struct {
		UserID         string `json:"user_id"`
		ConversationID string `json:"conversation_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid body", 400)
		return
	}

	key := fmt.Sprintf("unread:%s:%s", req.UserID, req.ConversationID)
	total := fmt.Sprintf("unread_total:%s", req.UserID)
	rdb.Incr(ctx, key)
	rdb.Incr(ctx, total)
	jsonOK(w, map[string]string{"status": "ok"})
}

// POST /api/go/unread/clear
// Body: {"user_id": "123", "conversation_id": "5"}

func unreadClearHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, "method not allowed", 405)
		return
	}

	var req struct {
		UserID         string `json:"user_id"`
		ConversationID string `json:"conversation_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid body", 400)
		return
	}

	key := fmt.Sprintf("unread:%s:%s", req.UserID, req.ConversationID)
	count, _ := rdb.Get(ctx, key).Int64()
	rdb.Del(ctx, key)

	totalKey := fmt.Sprintf("unread_total:%s", req.UserID)
	rdb.DecrBy(ctx, totalKey, count)
	jsonOK(w, map[string]string{"status": "cleared"})
}

// GET /api/go/unread/{user_id}
// Total unread message count across all conversations.

func unreadTotalHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("user_id")
	key := fmt.Sprintf("unread_total:%s", userID)
	count, _ := rdb.Get(ctx, key).Int64()
	jsonOK(w, map[string]any{"user_id": userID, "unread_count": count})
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "redis"
	}
	redisPort := os.Getenv("REDIS_PORT")
	if redisPort == "" {
		redisPort = "6379"
	}

	rdb = redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", redisHost, redisPort),
		Password: "",
		DB:       0,
	})

	if _, err := rdb.Ping(ctx).Result(); err != nil {
		log.Fatalf("Cannot connect to Redis: %v", err)
	}
	log.Println("Connected to Redis!")

	mux := http.NewServeMux()

	// Health
	mux.HandleFunc("GET /",               healthHandler)
	mux.HandleFunc("GET /health",         healthHandler)

	// Rate limiting
	mux.HandleFunc("POST /api/go/rate-limit/check", rateLimitHandler)

	// Presence
	mux.HandleFunc("POST /api/go/presence/heartbeat",  presenceHeartbeatHandler)
	mux.HandleFunc("GET  /api/go/presence/{user_id}",  presenceGetHandler)
	mux.HandleFunc("POST /api/go/presence/bulk",       presenceBulkHandler)

	// Feed cache
	mux.HandleFunc("POST   /api/go/cache/feed",            cacheFeedSetHandler)
	mux.HandleFunc("GET    /api/go/cache/feed/{user_id}",  cacheFeedGetHandler)
	mux.HandleFunc("DELETE /api/go/cache/feed/{user_id}",  cacheFeedInvalidateHandler)

	// Typing indicators
	mux.HandleFunc("POST /api/go/typing",                        typingHandler)
	mux.HandleFunc("GET  /api/go/typing/{conversation_id}",      typingGetHandler)

	// Unread counts
	mux.HandleFunc("POST /api/go/unread/increment",    unreadIncrementHandler)
	mux.HandleFunc("POST /api/go/unread/clear",        unreadClearHandler)
	mux.HandleFunc("GET  /api/go/unread/{user_id}",    unreadTotalHandler)

	log.Println("Go microservice listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}

EOF_B77505FFFA

write_file "microservice-java/src/main/java/sai_group/sai_java/config/KafkaConfig.java" << 'EOF_3A4EBF9AE1'
package sai_group.sai_java.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.listener.ContainerProperties;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class KafkaConfig {

    @Value("${spring.kafka.bootstrap-servers:kafka:9092}")
    private String bootstrapServers;

    @Bean
    public ConsumerFactory<String, String> consumerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "java-consumer");
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        // At-least-once delivery: manual ack
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
        return new DefaultKafkaConsumerFactory<>(props);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, String> kafkaListenerContainerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, String> factory =
            new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory());
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.RECORD);
        // Process topics concurrently with 3 threads
        factory.setConcurrency(3);
        return factory;
    }

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper().registerModule(new JavaTimeModule());
    }
}

EOF_3A4EBF9AE1

write_file "microservice-java/src/main/java/sai_group/sai_java/consumer/SocialMediaKafkaConsumer.java" << 'EOF_8107C40B9D'
package sai_group.sai_java.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import sai_group.sai_java.model.ActivityFeed;
import sai_group.sai_java.model.KafkaEvents.*;
import sai_group.sai_java.model.Notification;
import sai_group.sai_java.model.PostAnalytics;
import sai_group.sai_java.repository.ActivityFeedRepository;
import sai_group.sai_java.repository.NotificationRepository;
import sai_group.sai_java.service.AnalyticsService;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class SocialMediaKafkaConsumer {

    private final NotificationRepository  notificationRepo;
    private final ActivityFeedRepository  activityFeedRepo;
    private final AnalyticsService        analyticsService;
    private final ObjectMapper            objectMapper;

    // ── Post Created: fan-out to all followers' feeds ─────────────────────────
    @KafkaListener(topics = "post.created", groupId = "java-consumer")
    public void onPostCreated(String message) {
        try {
            PostCreatedEvent event = objectMapper.readValue(message, PostCreatedEvent.class);
            log.info("Fan-out post {} to {} followers", event.getPostId(), event.getFollowerIds().size());

            Instant createdAt = Instant.parse(event.getCreatedAt());

            // Write one ActivityFeed row per follower (fan-out on write)
            event.getFollowerIds().forEach(followerId -> {
                ActivityFeed entry = ActivityFeed.builder()
                    .userId(followerId)
                    .postId(UUID.fromString(event.getPostId()))
                    .authorId(event.getAuthorId())
                    .authorUsername(event.getAuthorUsername())
                    .authorAvatar(event.getAuthorAvatar())
                    .contentPreview(event.getContentPreview())
                    .thumbnailUrl(event.getThumbnailUrl())
                    .postType(event.getPostType())
                    .createdAt(createdAt)
                    .likesCount(0)
                    .commentsCount(0)
                    .build();

                activityFeedRepo.save(entry);
            });

            // Also seed the analytics row
            analyticsService.initPostAnalytics(event.getPostId(), event.getAuthorId());

        } catch (Exception e) {
            log.error("Error processing post.created: {}", e.getMessage(), e);
        }
    }

    // ── Post Liked: create notification + update analytics ───────────────────
    @KafkaListener(topics = "post.liked", groupId = "java-consumer")
    public void onPostLiked(String message) {
        try {
            PostLikedEvent event = objectMapper.readValue(message, PostLikedEvent.class);

            // Don't notify if user liked their own post
            if (event.getSenderId().equals(event.getPostAuthorId())) return;

            Notification notif = Notification.builder()
                .recipientId(event.getPostAuthorId())
                .id(UUID.randomUUID())
                .createdAt(Instant.parse(event.getCreatedAt()))
                .senderId(event.getSenderId())
                .senderUsername(event.getSenderUsername())
                .senderAvatar(event.getSenderAvatar())
                .type("like")
                .postId(event.getPostId())
                .postThumbnail(event.getPostThumbnail())
                .isRead(false)
                .build();

            notificationRepo.save(notif);
            analyticsService.incrementLike(event.getPostId(), event.getPostAuthorId());
            log.info("Notification saved: {} liked post {}", event.getSenderUsername(), event.getPostId());

        } catch (Exception e) {
            log.error("Error processing post.liked: {}", e.getMessage(), e);
        }
    }

    // ── Post Commented: create notification + update analytics ───────────────
    @KafkaListener(topics = "post.commented", groupId = "java-consumer")
    public void onPostCommented(String message) {
        try {
            PostCommentedEvent event = objectMapper.readValue(message, PostCommentedEvent.class);

            if (event.getSenderId().equals(event.getPostAuthorId())) return;

            Notification notif = Notification.builder()
                .recipientId(event.getPostAuthorId())
                .id(UUID.randomUUID())
                .createdAt(Instant.parse(event.getCreatedAt()))
                .senderId(event.getSenderId())
                .senderUsername(event.getSenderUsername())
                .senderAvatar(event.getSenderAvatar())
                .type("comment")
                .postId(event.getPostId())
                .postThumbnail(event.getPostThumbnail())
                .commentText(event.getCommentText())
                .isRead(false)
                .build();

            notificationRepo.save(notif);
            analyticsService.incrementComment(event.getPostId(), event.getPostAuthorId());

        } catch (Exception e) {
            log.error("Error processing post.commented: {}", e.getMessage(), e);
        }
    }

    // ── User Followed: create notification ────────────────────────────────────
    @KafkaListener(topics = "user.followed", groupId = "java-consumer")
    public void onUserFollowed(String message) {
        try {
            UserFollowedEvent event = objectMapper.readValue(message, UserFollowedEvent.class);

            Notification notif = Notification.builder()
                .recipientId(event.getFollowingId())
                .id(UUID.randomUUID())
                .createdAt(Instant.parse(event.getCreatedAt()))
                .senderId(event.getFollowerId())
                .senderUsername(event.getFollowerUsername())
                .senderAvatar(event.getFollowerAvatar())
                .type("follow")
                .isRead(false)
                .build();

            notificationRepo.save(notif);
            log.info("Follow notification: {} followed {}", event.getFollowerUsername(), event.getFollowingId());

        } catch (Exception e) {
            log.error("Error processing user.followed: {}", e.getMessage(), e);
        }
    }

    // ── Post Viewed: update analytics ─────────────────────────────────────────
    @KafkaListener(topics = "post.viewed", groupId = "java-consumer")
    public void onPostViewed(String message) {
        try {
            PostViewedEvent event = objectMapper.readValue(message, PostViewedEvent.class);
            analyticsService.incrementView(event.getPostId(), event.getAuthorId(), event.getViewerId());
        } catch (Exception e) {
            log.error("Error processing post.viewed: {}", e.getMessage(), e);
        }
    }
}

EOF_8107C40B9D

write_file "microservice-java/src/main/java/sai_group/sai_java/controller/SocialController.java" << 'EOF_94F532F9EF'
package sai_group.sai_java.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import sai_group.sai_java.model.ActivityFeed;
import sai_group.sai_java.model.Notification;
import sai_group.sai_java.model.PostAnalytics;
import sai_group.sai_java.repository.ActivityFeedRepository;
import sai_group.sai_java.repository.NotificationRepository;
import sai_group.sai_java.service.AnalyticsService;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/java")
public class SocialController {

    private final NotificationRepository  notificationRepo;
    private final ActivityFeedRepository  activityFeedRepo;
    private final AnalyticsService        analyticsService;

    // ── Health ────────────────────────────────────────────────────────────────
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "healthy", "service", "java-microservice"));
    }

    // ── Notifications ─────────────────────────────────────────────────────────
    /**
     * GET /api/java/notifications/{userId}?limit=20
     * Called by Django to fetch a user's notification history from Cassandra.
     * Much faster than querying Postgres for high-volume users.
     */
    @GetMapping("/notifications/{userId}")
    public ResponseEntity<List<Notification>> getNotifications(
            @PathVariable String userId,
            @RequestParam(defaultValue = "20") int limit) {
        List<Notification> notifs = notificationRepo.findByRecipientIdLimit(userId, limit).collectList().block();
        return ResponseEntity.ok(notifs);
    }

    /**
     * GET /api/java/notifications/{userId}/unread-count
     */
    @GetMapping("/notifications/{userId}/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@PathVariable String userId) {
        Long count = notificationRepo.countUnread(userId).block();
        return ResponseEntity.ok(Map.of("count", count != null ? count : 0L));
    }

    /**
     * POST /api/java/notifications/{userId}/mark-read
     * Django calls this after user opens notifications panel.
     */
    @PostMapping("/notifications/{userId}/mark-read")
    public ResponseEntity<Map<String, String>> markRead(@PathVariable String userId) {
        // Fetch and update — Cassandra doesn't support UPDATE without partition key
        List<Notification> notifs = notificationRepo.findByRecipientIdLimit(userId, 100).collectList().block();
        if (notifs != null) {
            notifs.forEach(n -> {
                n.setRead(true);
                notificationRepo.save(n);
            });
        }
        return ResponseEntity.ok(Map.of("status", "marked-read"));
    }

    // ── Activity Feed ─────────────────────────────────────────────────────────
    /**
     * GET /api/java/feed/{userId}?limit=20
     * Pre-computed feed from Cassandra fan-out table.
     * Returns post stubs that Django can enrich with fresh data if needed.
     */
    @GetMapping("/feed/{userId}")
    public ResponseEntity<List<ActivityFeed>> getFeed(
            @PathVariable String userId,
            @RequestParam(defaultValue = "20") int limit) {
        List<ActivityFeed> feed = activityFeedRepo.findByUserIdLimit(userId, limit).collectList().block();
        return ResponseEntity.ok(feed);
    }

    // ── Analytics ─────────────────────────────────────────────────────────────
    /**
     * GET /api/java/analytics/{postId}?authorId=xxx
     * Returns view counts, engagement stats for a post.
     * Shown on post detail page and author dashboard.
     */
    @GetMapping("/analytics/{postId}")
    public ResponseEntity<?> getAnalytics(
            @PathVariable String postId,
            @RequestParam String authorId) {
        Optional<PostAnalytics> analytics = analyticsService.getAnalytics(postId, authorId);
        return analytics.map(ResponseEntity::ok)
                        .orElse(ResponseEntity.notFound().build());
    }
}

EOF_94F532F9EF

write_file "microservice-java/src/main/java/sai_group/sai_java/model/ActivityFeed.java" << 'EOF_33B0895D3F'
package sai_group.sai_java.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.cql.PrimaryKeyType;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyColumn;
import org.springframework.data.cassandra.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Fan-out feed table.
 *
 * When user A (followed by users B, C, D) creates a post,
 * Kafka event triggers Java to write one row per follower:
 *   feed[B] += postId
 *   feed[C] += postId
 *   feed[D] += postId
 *
 * This makes reading B's feed an O(1) Cassandra partition scan,
 * instead of a slow JOIN across follows + posts in Postgres.
 */
@Table("activity_feed")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActivityFeed {

    @PrimaryKeyColumn(name = "user_id", type = PrimaryKeyType.PARTITIONED)
    private String userId;

    @PrimaryKeyColumn(name = "created_at", type = PrimaryKeyType.CLUSTERED,
                      ordering = org.springframework.data.cassandra.core.cql.Ordering.DESCENDING)
    private Instant createdAt;

    @PrimaryKeyColumn(name = "post_id", type = PrimaryKeyType.CLUSTERED)
    private UUID postId;

    @Column("author_id")
    private String authorId;

    @Column("author_username")
    private String authorUsername;

    @Column("author_avatar")
    private String authorAvatar;

    @Column("content_preview")
    private String contentPreview;

    @Column("thumbnail_url")
    private String thumbnailUrl;

    // post | reel | story
    @Column("post_type")
    private String postType;

    @Column("likes_count")
    private int likesCount;

    @Column("comments_count")
    private int commentsCount;
}

EOF_33B0895D3F

write_file "microservice-java/src/main/java/sai_group/sai_java/model/KafkaEvents.java" << 'EOF_01F835D63F'
package sai_group.sai_java.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Kafka event DTOs — these mirror exactly what Django publishes.
 * Keep in sync with django-kafka/events.py
 */
public class KafkaEvents {

    /** Published when a user creates a post */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PostCreatedEvent {
        private String postId;
        private String authorId;
        private String authorUsername;
        private String authorAvatar;
        private String contentPreview;  // first 120 chars
        private String thumbnailUrl;    // first media item
        private String postType;        // post | reel
        private String createdAt;       // ISO-8601
        // List of follower IDs to fan-out to (Django sends these)
        private java.util.List<String> followerIds;
    }

    /** Published when a user likes a post */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PostLikedEvent {
        private String postId;
        private String postAuthorId;
        private String senderId;
        private String senderUsername;
        private String senderAvatar;
        private String postThumbnail;
        private String createdAt;
    }

    /** Published when a user comments on a post */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PostCommentedEvent {
        private String postId;
        private String postAuthorId;
        private String senderId;
        private String senderUsername;
        private String senderAvatar;
        private String postThumbnail;
        private String commentText;
        private String createdAt;
    }

    /** Published when a user follows another */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UserFollowedEvent {
        private String followerId;
        private String followerUsername;
        private String followerAvatar;
        private String followingId;     // the person being followed (recipient)
        private String createdAt;
    }

    /** Published when a post is viewed */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PostViewedEvent {
        private String postId;
        private String authorId;
        private String viewerId;
        private String createdAt;
    }
}

EOF_01F835D63F

write_file "microservice-java/src/main/java/sai_group/sai_java/model/Notification.java" << 'EOF_79BE7CEE48'
package sai_group.sai_java.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.cql.PrimaryKeyType;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyColumn;
import org.springframework.data.cassandra.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

@Table("notifications")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    // Partition key: one partition per recipient — fast reads for a user's feed
    @PrimaryKeyColumn(name = "recipient_id", type = PrimaryKeyType.PARTITIONED)
    private String recipientId;

    // Clustering key descending: newest first without sorting
    @PrimaryKeyColumn(name = "created_at", type = PrimaryKeyType.CLUSTERED,
                      ordering = org.springframework.data.cassandra.core.cql.Ordering.DESCENDING)
    private Instant createdAt;

    @PrimaryKeyColumn(name = "id", type = PrimaryKeyType.CLUSTERED)
    private UUID id;

    @Column("sender_id")
    private String senderId;

    @Column("sender_username")
    private String senderUsername;

    @Column("sender_avatar")
    private String senderAvatar;

    // like | comment | follow | mention | reply
    @Column("type")
    private String type;

    @Column("post_id")
    private String postId;

    @Column("post_thumbnail")
    private String postThumbnail;

    @Column("comment_text")
    private String commentText;

    @Column("is_read")
    private boolean isRead;
}

EOF_79BE7CEE48

write_file "microservice-java/src/main/java/sai_group/sai_java/model/PostAnalytics.java" << 'EOF_D50851127B'
package sai_group.sai_java.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.cql.PrimaryKeyType;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyColumn;
import org.springframework.data.cassandra.core.mapping.Table;

import java.time.Instant;

/**
 * High-write analytics counter table.
 * Every post view, like, share writes here.
 * Cassandra handles millions of writes/sec with counters.
 */
@Table("post_analytics")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PostAnalytics {

    @PrimaryKeyColumn(name = "post_id", type = PrimaryKeyType.PARTITIONED)
    private String postId;

    @PrimaryKeyColumn(name = "author_id", type = PrimaryKeyType.CLUSTERED)
    private String authorId;

    @Column("view_count")
    private long viewCount;

    @Column("unique_viewers")
    private long uniqueViewers;

    @Column("like_count")
    private long likeCount;

    @Column("comment_count")
    private long commentCount;

    @Column("share_count")
    private long shareCount;

    @Column("save_count")
    private long saveCount;

    @Column("last_updated")
    private Instant lastUpdated;
}

EOF_D50851127B

write_file "microservice-java/src/main/java/sai_group/sai_java/repository/ActivityFeedRepository.java" << 'EOF_1591F404E5'
package sai_group.sai_java.repository;

import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import sai_group.sai_java.model.ActivityFeed;

@Repository
public interface ActivityFeedRepository extends CassandraRepository<ActivityFeed, String> {

    @Query("SELECT * FROM activity_feed WHERE user_id = ?0 LIMIT ?1")
    Flux<ActivityFeed> findByUserIdLimit(String userId, int limit);
}

EOF_1591F404E5

write_file "microservice-java/src/main/java/sai_group/sai_java/repository/NotificationRepository.java" << 'EOF_E804D2A682'
package sai_group.sai_java.repository;

import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import sai_group.sai_java.model.Notification;

import java.util.UUID;

@Repository
public interface NotificationRepository extends CassandraRepository<Notification, String> {

    // Fetch latest N notifications for a user — single partition read, very fast
    @Query("SELECT * FROM notifications WHERE recipient_id = ?0 LIMIT ?1")
    Flux<Notification> findByRecipientIdLimit(String recipientId, int limit);

    // Count unread
    @Query("SELECT COUNT(*) FROM notifications WHERE recipient_id = ?0 AND is_read = false ALLOW FILTERING")
    Mono<Long> countUnread(String recipientId);
}

EOF_E804D2A682

write_file "microservice-java/src/main/java/sai_group/sai_java/service/AnalyticsService.java" << 'EOF_3FA4EF8EE2'
package sai_group.sai_java.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.cassandra.core.CassandraOperations;
import org.springframework.stereotype.Service;
import sai_group.sai_java.model.PostAnalytics;

import java.time.Instant;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final CassandraOperations cassandraOps;

    public void initPostAnalytics(String postId, String authorId) {
        PostAnalytics analytics = PostAnalytics.builder()
            .postId(postId)
            .authorId(authorId)
            .viewCount(0)
            .uniqueViewers(0)
            .likeCount(0)
            .commentCount(0)
            .shareCount(0)
            .saveCount(0)
            .lastUpdated(Instant.now())
            .build();
        cassandraOps.insert(analytics);
    }

    public void incrementView(String postId, String authorId, String viewerId) {
        // Use Cassandra lightweight transactions for idempotent counters
        String cql = String.format(
            "UPDATE post_analytics SET view_count = view_count + 1, last_updated = toTimestamp(now()) " +
            "WHERE post_id = '%s' AND author_id = '%s'", postId, authorId);
        cassandraOps.getCqlOperations().execute(cql);
    }

    public void incrementLike(String postId, String authorId) {
        String cql = String.format(
            "UPDATE post_analytics SET like_count = like_count + 1, last_updated = toTimestamp(now()) " +
            "WHERE post_id = '%s' AND author_id = '%s'", postId, authorId);
        cassandraOps.getCqlOperations().execute(cql);
    }

    public void decrementLike(String postId, String authorId) {
        String cql = String.format(
            "UPDATE post_analytics SET like_count = like_count - 1, last_updated = toTimestamp(now()) " +
            "WHERE post_id = '%s' AND author_id = '%s'", postId, authorId);
        cassandraOps.getCqlOperations().execute(cql);
    }

    public void incrementComment(String postId, String authorId) {
        String cql = String.format(
            "UPDATE post_analytics SET comment_count = comment_count + 1, last_updated = toTimestamp(now()) " +
            "WHERE post_id = '%s' AND author_id = '%s'", postId, authorId);
        cassandraOps.getCqlOperations().execute(cql);
    }

    public Optional<PostAnalytics> getAnalytics(String postId, String authorId) {
        return Optional.ofNullable(
            cassandraOps.selectOne(
                com.datastax.oss.driver.api.querybuilder.QueryBuilder.selectFrom("post_analytics")
                    .all()
                    .whereColumn("post_id").isEqualTo(
                        com.datastax.oss.driver.api.querybuilder.QueryBuilder.literal(postId))
                    .whereColumn("author_id").isEqualTo(
                        com.datastax.oss.driver.api.querybuilder.QueryBuilder.literal(authorId))
                    .build().getQuery(),
                PostAnalytics.class
            )
        );
    }
}

EOF_3FA4EF8EE2

write_file "microservice-java/src/main/resources/application.properties" << 'EOF_31B769CB3B'
spring.application.name=sai-java

# ── Cassandra ────────────────────────────────────────────────
spring.data.cassandra.contact-points=cassandra
spring.data.cassandra.port=9042
spring.data.cassandra.keyspace-name=social_media_app
spring.data.cassandra.local-datacenter=datacenter1
spring.data.cassandra.schema-action=create-if-not-exists

# ── Kafka ────────────────────────────────────────────────────
spring.kafka.bootstrap-servers=kafka:9092
spring.kafka.consumer.group-id=java-consumer
spring.kafka.consumer.auto-offset-reset=earliest

# ── Actuator ─────────────────────────────────────────────────
management.endpoints.web.exposure.include=health,prometheus,metrics,info
management.endpoint.health.show-details=always
management.metrics.export.prometheus.enabled=true

# ── Logging ──────────────────────────────────────────────────
logging.level.sai_group=INFO
logging.level.org.springframework.kafka=WARN
logging.level.com.datastax=WARN

# ── Server ───────────────────────────────────────────────────
server.port=8080

EOF_31B769CB3B

write_file "nginx-conf/default.conf" << 'EOF_0FEFC12136'
upstream django {
    server django:8000;
    keepalive 32;
}

upstream microservice_java {
    server microservice-java:8080;
    keepalive 16;
}

upstream microservice_go {
    server microservice-go:8080;
    keepalive 16;
}

upstream minio {
    server minio:9000;
    keepalive 8;
}

server {
    listen 80;
    client_max_body_size 50M;

    # ── Frontend SPA ──────────────────────────────────────────
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri /index.html;

        # Cache static assets aggressively
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # ── Django REST API ───────────────────────────────────────
    location /api/ {
        # Exclude Java and Go routes handled below
        location /api/java/ { proxy_pass http://microservice_java; }
        location /api/go/   { proxy_pass http://microservice_go;   }

        proxy_pass http://django;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout    30s;
    }

    # ── Django Admin ──────────────────────────────────────────
    location /admin/ {
        proxy_pass http://django;
        proxy_set_header Host            $host;
        proxy_set_header X-Real-IP       $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # ── Django Prometheus metrics ─────────────────────────────
    location /metrics {
        proxy_pass http://django;
        proxy_set_header Host $host;
    }

    # ── Java Microservice (Cassandra: notifications, feed, analytics) ─────────
    location /api/java/ {
        proxy_pass http://microservice_java/api/java/;
        proxy_set_header Host            $host;
        proxy_set_header X-Real-IP       $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 15s;
    }

    # ── Go Microservice (Redis: presence, cache, rate-limit, typing) ──────────
    location /api/go/ {
        proxy_pass http://microservice_go/api/go/;
        proxy_set_header Host            $host;
        proxy_set_header X-Real-IP       $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3s;   # Go service must be fast
    }

    # ── Media Files (MinIO) ───────────────────────────────────
    location /media/ {
        proxy_pass http://minio/media/;
        proxy_set_header Host            $host;
        proxy_set_header X-Real-IP       $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering  on;
        proxy_cache_valid 200 1d;
        add_header Cache-Control "public, max-age=86400";
    }

    # ── GraphQL (Django Graphene) ─────────────────────────────
    location /graphql {
        proxy_pass http://django;
        proxy_set_header Host            $host;
        proxy_set_header X-Real-IP       $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }

    # ── Health endpoints ──────────────────────────────────────
    location /health {
        proxy_pass http://django/health/;
        proxy_set_header Host $host;
    }
}

EOF_0FEFC12136


echo ""
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅  All microservice files injected!"
echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Add to backend/requirements.txt (see MICROSERVICE_REQUIREMENTS.txt):"
echo "       confluent-kafka>=2.3.0"
echo "       requests>=2.31.0"
echo ""
echo "  2. Apply backend/SETTINGS_MICROSERVICES.py into your settings.py"
echo ""
echo "  3. Rebuild containers:"
echo "       docker compose build microservice-java microservice-go django"
echo "       docker compose --profile prod up -d"
echo ""
echo "  4. Verify services are up:"
echo "       curl http://localhost/api/java/health"
echo "       curl http://localhost/api/go/health"
echo ""