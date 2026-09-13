from django.core.exceptions import FieldError

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import *

from .serializers import RegisterSerializer
from rest_framework import status


class UserView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response({"username": request.user.username, "role": request.user.userprofile.role})

    def post(self, request):
        role = request.data["role"]
        user = request.user
        user.role = role
        user.save()
        if user.role == User.Role.BUYER:
            Buyer.objects.create(user=user)
            return Response(
                {
                    "message": "User created successfully. Your role is Buyer",
                    "success": True
                }
            )
        if user.role == User.Role.SELLER:
                Seller.objects.create(user=user)
                return Response(
                    {
                        "message": "User created successfully. Your role is Seller",
                        "success": True
                    }
                )


class BuyerView(APIView):
    
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        buyer = request.user.buyer

        return Response({
            "username": buyer.user.username
        })


class SellerView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        seller = request.user.seller

        return Response({
            "username": seller.user.username
        })
    

class CartView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        buyer = request.user.buyer
        return Response({
            "buyer": buyer.user.username,
            "cart_id": buyer.cart.id
        })


class CartItemView(APIView):
    permission_classes = (IsAuthenticated,)
    
    def get(self, request):
        buyer = request.user.buyer
        cart = buyer.cart
        items = cart.cartitem_set.all()
        data = []

        for item in items:
            data.append({
                "product": item.product.id,
                "quantity": item.quantity
            })

        return Response(data)

    def post(self, request):
        try: 
            buyer = request.user.buyer
            cart = buyer.cart
            CartItem.objects.create(cart=cart, product=Product.objects.get(id=request.data["product"]), quantity=request.data["quantity"])
            return Response(
                {
                    "message": "Item added successfully",
                    "success": True
                }
            )
        except FieldError:
            return Response({
                "message": "There is some errors in your field, Please try again",
                "success": False
            })


class ItemStockView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        seller = request.user.seller
        item_stock = seller.itemstock_set.all()
        data = []
        
        for item in item_stock:
            data.append({
                "product": item.product.id,
                "quantity": item.quantity
            })
        
        return Response(data)

    def post(self, request):
        try:
            seller = request.user.seller
            ItemStock.objects.create(seller=seller, product=Product.objects.get(id=request.data["product"]), quantity=request.data["quantity"])
            return Response(
                    {
                                        "message": "Item added successfully",
                                        "success": True
                                    }
                                )
        except FieldError:
            return Response({
                "message": "There is some errors in your field, Please try again",
                "success": False
            })

class RegisterView(APIView):

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()

            return Response(
                {"message": "User created successfully"},
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

