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

