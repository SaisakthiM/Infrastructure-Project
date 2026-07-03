from django.urls import path
from .views import BookListView, BookDetailView, SummarizeBookView, AskQuestionView, RecommendationView

urlpatterns = [
    path('books/', BookListView.as_view()),
    path('books/<int:id>/', BookDetailView.as_view()),
    path('books/<int:id>/summarize/', SummarizeBookView.as_view()),
    path('books/<int:id>/recommendations/', RecommendationView.as_view()),
    path('ask/', AskQuestionView.as_view()),
]