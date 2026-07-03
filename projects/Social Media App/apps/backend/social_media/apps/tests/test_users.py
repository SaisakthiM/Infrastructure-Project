from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.users.models import Follow

User = get_user_model()


def make_user(username="testuser", password="TestPass123!", **kwargs):
    return User.objects.create_user(
        username=username,
        password=password,
        email=f"{username}@test.com",
        profile_name=kwargs.pop("profile_name", username),
        **kwargs,
    )


class RegisterViewTest(TestCase):

    def setUp(self):
        self.client = APIClient()

    """ def test_register_valid_user_returns_201(self):
        response = self.client.post("/api/auth/register/", {
            "username": "newuser",
            "email": "new@test.com",
            "profile_name": "New User",
            "password": "TestPass123!",
            "password2": "TestPass123!",
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertIn("user", response.data)"""

    def test_register_returns_user_data(self):
        response = self.client.post("/api/auth/register/", {
            "username": "newuser",
            "email": "new@test.com",
            "profile_name": "New User",
            "password": "TestPass123!",
            "password2": "TestPass123!",
        })
        self.assertEqual(response.data["user"]["username"], "newuser")

    def test_register_mismatched_passwords_returns_400(self):
        response = self.client.post("/api/auth/register/", {
            "username": "newuser",
            "email": "new@test.com",
            "profile_name": "New User",
            "password": "TestPass123!",
            "password2": "WrongPass123!",
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_duplicate_username_returns_400(self):
        make_user("existinguser")
        response = self.client.post("/api/auth/register/", {
            "username": "existinguser",
            "email": "other@test.com",
            "profile_name": "Other",
            "password": "TestPass123!",
            "password2": "TestPass123!",
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_fields_returns_400(self):
        response = self.client.post("/api/auth/register/", {
            "username": "newuser",
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_short_password_returns_400(self):
        response = self.client.post("/api/auth/register/", {
            "username": "newuser",
            "email": "new@test.com",
            "profile_name": "New",
            "password": "short",
            "password2": "short",
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginViewTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("loginuser", "TestPass123!")

    def test_login_valid_credentials_returns_200(self):
        response = self.client.post("/api/auth/login/", {
            "username": "loginuser",
            "password": "TestPass123!",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_invalid_password_returns_400(self):
        response = self.client.post("/api/auth/login/", {
            "username": "loginuser",
            "password": "WrongPass!",
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_nonexistent_user_returns_400(self):
        response = self.client.post("/api/auth/login/", {
            "username": "nobody",
            "password": "TestPass123!",
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class MeViewTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("meuser")

    def test_me_authenticated_returns_200(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "meuser")

    def test_me_unauthenticated_returns_401(self):
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class UserProfileViewTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("profileuser")

    def test_get_existing_profile_returns_200(self):
        response = self.client.get("/api/users/profileuser/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "profileuser")

    def test_get_nonexistent_profile_returns_404(self):
        response = self.client.get("/api/users/doesnotexist/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_profile_returns_counts(self):
        response = self.client.get("/api/users/profileuser/")
        self.assertIn("followers_count", response.data)
        self.assertIn("following_count", response.data)
        self.assertIn("posts_count", response.data)


class FollowToggleTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user1 = make_user("user1")
        self.user2 = make_user("user2")

    def test_follow_user_returns_following_true(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(f"/api/users/user2/follow/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["following"])
        self.assertTrue(Follow.objects.filter(follower=self.user1, following=self.user2).exists())

    def test_unfollow_user_returns_following_false(self):
        Follow.objects.create(follower=self.user1, following=self.user2)
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(f"/api/users/user2/follow/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["following"])
        self.assertFalse(Follow.objects.filter(follower=self.user1, following=self.user2).exists())

    def test_cannot_follow_yourself(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(f"/api/users/user1/follow/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_follow_unauthenticated_returns_401(self):
        response = self.client.post(f"/api/users/user2/follow/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_follow_nonexistent_user_returns_404(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post("/api/users/nobody/follow/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class SearchUsersTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("searcher")
        make_user("john_doe", profile_name="John Doe")
        make_user("jane_smith", profile_name="Jane Smith")

    def test_search_returns_matching_users(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/users/search/?q=john")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["username"], "john_doe")

    def test_search_empty_query_returns_empty(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/users/search/?q=")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_search_excludes_self(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/users/search/?q=searcher")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_search_unauthenticated_returns_401(self):
        response = self.client.get("/api/users/search/?q=john")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)