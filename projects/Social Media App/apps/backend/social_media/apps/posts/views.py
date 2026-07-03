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
from django_ratelimit.decorators import ratelimit

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
@ratelimit(key='user', rate='20/h', method='POST', block=True)  # 20 posts per hour per user
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
@ratelimit(key='user', rate='20/h', method='POST', block=True)  # 20 posts per hour per user
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
@ratelimit(key='user', rate='30/h', method='POST', block=True)  # 30 edits per hour per user
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

