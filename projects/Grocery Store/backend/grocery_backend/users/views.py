from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import 


class HelloView(APIView):
    permission_classes = (IsAuthenticated, )

    def get_items(request):
        