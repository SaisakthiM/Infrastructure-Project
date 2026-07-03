from rest_framework import generics, viewsets, permissions
from rest_framework.exceptions import Throttled
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
from django.contrib.auth.models import User
from .serializers import UserSerializer, NoteSerializer
from rest_framework.permissions import AllowAny
from .models import Note



# ─── CUSTOM THROTTLE CLASSES ──────────────────────────────────
# Define these here or in a shared throttles.py file

class NoteCreateThrottle(UserRateThrottle):
    """Max 60 note creates/updates per hour per user."""
    scope = 'note_create'
    THROTTLE_RATES = {'note_create': '60/hour'}

class RegisterThrottle(AnonRateThrottle):
    """Max 5 registrations per minute per IP."""
    scope = 'register'
    THROTTLE_RATES = {'register': '5/min'}


# ─── VIEWS ────────────────────────────────────────────────────

class CreateUserView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    queryset = User.objects.all()
    serializer_class = UserSerializer
    throttle_classes = [RegisterThrottle]   # rate limit registration


class NoteViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = NoteSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [NoteCreateThrottle]

    def get_queryset(self):  # type: ignore[override]
        return Note.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)