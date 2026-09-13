from django.urls import path, include
from rest_framework_simplejwt import views as jwt_views
from .views import *

urlpatterns = [
     path('user/', UserView.as_view(), name="user_view"), 
     path('buyer/', BuyerView.as_view(), name="buyer_view"), 
     path('seller/', SellerView.as_view(), name="seller_view"), 
     path('cart/', CartView.as_view(), name="cart_view"), 
     path('cart_item/', CartItemView.as_view(), name="cart_item_view"), 
     path('item_stock/', ItemStockView.as_view(), name="item_stock"), 
     path('api/register/', RegisterView.as_view(), name="register_view")
]