from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.auth import views as auth_views

urlpatterns = [
    path('', include('django_prometheus.urls')),
    path('admin/', admin.site.urls),
    path('blog/', include('blog.urls')),
    # Override only what you need, don't include all of auth.urls
    path('accounts/login/', auth_views.LoginView.as_view(template_name='blog/login.html'), name='login'),
    path('accounts/logout/', auth_views.LogoutView.as_view(next_page='/blog/'), name='logout'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)