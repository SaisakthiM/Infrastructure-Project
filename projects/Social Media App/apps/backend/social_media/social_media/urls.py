from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView
from django_prometheus import exports   


def health_check(request):
    return JsonResponse({"status": "healthy"}, status=200)


urlpatterns = [
    path("health/", health_check),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("admin/", admin.site.urls),
    path("api/", include("apps.users.urls")),
    path("api/posts/", include("apps.posts.urls")),
    path("api/stories/", include("apps.stories.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/messages/", include("apps.messages.urls")),
    path('metrics', exports.ExportToDjangoView, name='prometheus-django-metrics'),  # ← add
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

