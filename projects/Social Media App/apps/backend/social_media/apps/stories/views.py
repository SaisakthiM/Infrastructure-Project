from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.utils import timezone
from django.shortcuts import get_object_or_404
from .models import Story, StoryView
from .serializers import StorySerializer
from apps.users.models import Follow


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

