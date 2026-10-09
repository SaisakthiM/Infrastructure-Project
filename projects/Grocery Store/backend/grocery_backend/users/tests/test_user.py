from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from users import models

class RegisterTests(APITestCase):
    def test_register_creates_user(self):
        response = self.client.post("/api/register/", {"username": "test", "password": "test@20080", "role": "BY"}, format="json")
        print(response.data)
        self.assertEqual(response.status_code, 201)
        self.assertTrue(get_user_model().objects.filter(username="test").exists())

class CartItemTests(APITestCase):
    def setUp(self):
        self.user =  models.UserProfile(user="test1", password="test1@2000", role="Buyer")       # create a user
        self.user.save()
        # what has to exist before request.user.buyer works?
        self.client.force_authenticate(user=self.user)
        self.assertTrue(get_user_model().objects.filter(username="test1").exists())
    
    