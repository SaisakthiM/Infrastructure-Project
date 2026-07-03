from rest_framework import serializers
from .models import Notification
from apps.users.serializers import UserMinimalSerializer


class NotificationSerializer(serializers.ModelSerializer):
    sender = UserMinimalSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = ['id', 'sender', 'notif_type', 'post', 'comment', 'is_read', 'created_at']
        read_only_fields = ['id', 'sender', 'created_at']

