from django.urls import path

from . import views

urlpatterns = [
    path("products/", views.ProductListView.as_view()),
    path("checkout/", views.CheckoutView.as_view()),
    path("orders/", views.OrderListView.as_view()),
    path("shift/start/", views.ShiftStartView.as_view()),
    path("shift/finish/", views.ShiftFinishView.as_view()),
    path("summary/", views.SummaryView.as_view()),
]
