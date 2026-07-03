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

