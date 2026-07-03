from django.urls import path
from . import views

urlpatterns = [
    path('', views.conversations_list, name='conversations-list'),
    path('start/', views.get_or_create_conversation, name='start-conversation'),
    path('<int:pk>/messages/', views.conversation_messages, name='conversation-messages'),
    path('<int:pk>/send/', views.send_message, name='send-message'),
]

