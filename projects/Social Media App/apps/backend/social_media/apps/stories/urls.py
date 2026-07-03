from django.urls import path
from . import views

urlpatterns = [
    path('', views.stories_feed, name='stories-feed'),
    path('create/', views.create_story, name='create-story'),
    path('<int:pk>/delete/', views.delete_story, name='delete-story'),
    path('<int:pk>/view/', views.view_story, name='view-story'),
]

