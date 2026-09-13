from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from rest_framework import serializers
from .models import *


class RegisterSerializer(serializers.ModelSerializer):

    role = serializers.ChoiceField(
        choices=UserProfile.Role.choices
    )

    class Meta:
        model = User
        fields = ["username", "password", "role"]
        extra_kwargs = {
            "password": {"write_only": True}
        }

    def create(self, validated_data):
        role = validated_data.pop("role")
        password = validated_data.pop("password")

        user = User.objects.create_user(
            password=password,
            **validated_data
        )

        UserProfile.objects.create(
            user=user,
            role=role
        )

        return user
