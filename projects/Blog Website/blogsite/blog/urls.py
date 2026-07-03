from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('post/<int:pk>/', views.post_detail, name='post_detail'),
    path('edit/<int:pk>/', views.edit_post, name='edit_post'),
    path('register/', views.register, name='register'),
    path('login/', views.login_view, name='login'),        # ← custom view now
    path('logout/', views.logout_view, name='logout'),     # ← custom view now
    path('profile/', views.profile, name='profile'),
    path('post/new/', views.create_post, name='create_post'),
    path('post/<int:pk>/delete/', views.delete_post, name='delete_post'),
]