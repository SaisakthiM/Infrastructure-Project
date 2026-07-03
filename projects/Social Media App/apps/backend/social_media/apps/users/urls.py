from django.urls import path
from . import views

urlpatterns = [
    path('auth/register/', views.register, name='register'),
    path('auth/login/', views.login, name='login'),
    path('auth/logout/', views.logout, name='logout'),
    path('auth/me/', views.me, name='me'),
    path('users/search/', views.search_users, name='search-users'),
    path('users/suggested/', views.suggested_users, name='suggested-users'),
    path('users/<str:username>/', views.user_profile, name='user-profile'),
    path('users/<str:username>/update/', views.update_profile, name='update-profile'),
    path('users/<str:username>/follow/', views.follow_toggle, name='follow-toggle'),
    path('users/<str:username>/followers/', views.followers_list, name='followers-list'),
    path('users/<str:username>/following/', views.following_list, name='following-list'),
]

