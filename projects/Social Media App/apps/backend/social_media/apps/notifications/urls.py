from django.urls import path
from . import views

urlpatterns = [
    path('', views.notifications_list, name='notifications-list'),
    path('read/', views.mark_read, name='mark-read'),
    path('unread/', views.unread_count, name='unread-count'),
]

