from django.test import TestCase, Client
from django.contrib.auth.models import User
from blog.models import Post

class HomeViewTest(TestCase):

    def setUp(self):
        self.client = Client()
        self.user1 = User.objects.create_user(
            username="testuser1",
            password="TestPass123!"
        )
        self.user2 = User.objects.create_user(
            username="testuser2",
            password="TestPass123!"
        )
        self.post = Post.objects.create(
            title="Test Post",
            content="Test content",
            author=self.user1
        )

    def test_home_page_returns_200(self):
        response = self.client.get("/blog/")
        self.assertEqual(response.status_code, 200)

    def test_login_page_returns_200(self):
        response = self.client.get("/blog/login/")
        self.assertEqual(response.status_code, 200)

    def test_unauthenticated_create_post_redirects(self):
        response = self.client.get("/blog/create/")
        self.assertEqual(response.status_code, 302)

    def test_login_with_valid_credentials(self):
        response = self.client.post("/blog/login/", {
            "username": "testuser1",
            "password": "TestPass123!"
        })
        self.assertEqual(response.status_code, 302)

    def test_login_with_wrong_password(self):
        response = self.client.post("/blog/login/", {
            "username": "testuser1",
            "password": "wrongpassword"
        })
        self.assertEqual(response.status_code, 200)

    def test_authenticated_user_can_access_create_post(self):
        self.client.login(username="testuser1", password="TestPass123!")
        response = self.client.get("/blog/create/")
        self.assertEqual(response.status_code, 200)

    def test_owner_can_edit_post(self):
        self.client.login(username="testuser1", password="TestPass123!")
        response = self.client.get(f"/blog/edit/{self.post.pk}/")
        self.assertEqual(response.status_code, 200)

    def test_non_owner_cannot_edit_post(self):
        self.client.login(username="testuser2", password="TestPass123!")
        response = self.client.get(f"/blog/edit/{self.post.pk}/")
        self.assertEqual(response.status_code, 302)

    def test_delete_post_by_owner(self):
        self.client.login(username="testuser1", password="TestPass123!")
        response = self.client.post(f"/blog/delete/{self.post.pk}/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(Post.objects.count(), 0)

    def test_post_appears_on_home_page(self):
        response = self.client.get("/blog/")
        self.assertContains(response, self.post.title)