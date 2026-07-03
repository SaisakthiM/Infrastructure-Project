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
        if not obj.profile_picture:
            return None
        url = obj.profile_picture.url
        url = url.replace('http://django:8000', 'http://localhost:8000')
        url = url.replace('http://minio:9000', 'http://localhost/social/minio')
        return url


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
        if not obj.profile_picture:
            return None
        url = obj.profile_picture.url
        url = url.replace('http://django:8000', 'http://localhost:8000')
        url = url.replace('http://minio:9000', 'http://localhost/social/minio')
        return url

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

