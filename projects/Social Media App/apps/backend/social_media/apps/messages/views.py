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
    total = messages.count()
    msgs_page = messages[start:end]
    return Response({
        'results': MessageSerializer(msgs_page, many=True, context={'request': request}).data,
        'has_more': end < total,
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

