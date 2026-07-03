"""
users/views.py — DRF API views with proper rate limiting.
Uses DRF throttle classes, NOT django-ratelimit (which is for Django views only).
"""
import requests
import logging
from django.conf import settings
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
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


# ─── THROTTLE CLASSES ─────────────────────────────────────────

class RegisterThrottle(AnonRateThrottle):
    """5 registrations per minute per IP."""
    scope = 'register'

class LoginThrottle(AnonRateThrottle):
    """10 login attempts per minute per IP."""
    scope = 'login'

class ProfileUpdateThrottle(UserRateThrottle):
    """10 profile updates per hour per user."""
    scope = 'profile_update'


# ─── HELPERS ──────────────────────────────────────────────────

def _go(method, path, **kwargs):
    try:
        return requests.request(method, f"{GO_SERVICE}{path}", timeout=0.5, **kwargs)
    except Exception as e:
        logger.warning("Go service call failed: %s", e)
        return None


# ─── AUTH ─────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([RegisterThrottle])
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
@throttle_classes([LoginThrottle])
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
    _go('POST', '/api/go/presence/heartbeat', json={'user_id': str(request.user.id)})
    return Response({'detail': 'Logged out.'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    _go('POST', '/api/go/presence/heartbeat', json={'user_id': str(request.user.id)})
    return Response(UserSerializer(request.user, context={'request': request}).data)


# ─── USERS ────────────────────────────────────────────────────

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
@throttle_classes([ProfileUpdateThrottle])
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
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)
    resp = _go('GET', f'/api/go/presence/{user.id}')
    if resp and resp.status_code == 200:
        return Response(resp.json())
    return Response({'online': False, 'last_seen': None})