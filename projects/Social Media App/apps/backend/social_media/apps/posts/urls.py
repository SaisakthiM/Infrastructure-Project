from django.urls import path
from . import views

urlpatterns = [
    path('', views.feed, name='feed'),
    path('explore/', views.explore, name='explore'),
    path('create/', views.create_post, name='create-post'),
    path('search/', views.search_posts, name='search-posts'),
    path('saved/', views.saved_posts, name='saved-posts'),
    path('<int:pk>/', views.post_detail, name='post-detail'),
    path('<int:pk>/like/', views.like_toggle, name='like-toggle'),
    path('<int:pk>/save/', views.save_toggle, name='save-toggle'),
    path('<int:pk>/comments/', views.post_comments, name='post-comments'),
    path('comments/<int:pk>/', views.delete_comment, name='delete-comment'),
    path('user/<str:username>/', views.user_posts, name='user-posts'),
]

