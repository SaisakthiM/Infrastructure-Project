from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from unittest.mock import patch
from apps.posts.models import Post, Comment, Like, Save
from apps.users.models import Follow

User = get_user_model()


def make_user(username="testuser", **kwargs):
    return User.objects.create_user(
        username=username,
        password="TestPass123!",
        email=f"{username}@test.com",
        profile_name=kwargs.pop("profile_name", username),
        **kwargs,
    )


def make_post(author, content="Test post content"):
    return Post.objects.create(author=author, content=content)


class FeedViewTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("feeduser")
        self.other = make_user("otheruser")
        Follow.objects.create(follower=self.user, following=self.other)
        self.post = make_post(self.other, "Other's post")
        self.own_post = make_post(self.user, "My post")

    @patch("apps.posts.views._go", return_value=None)
    def test_feed_returns_own_and_followed_posts(self, mock_go):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/posts/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total"], 2)

    @patch("apps.posts.views._go", return_value=None)
    def test_feed_unauthenticated_returns_401(self, mock_go):
        response = self.client.get("/api/posts/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("apps.posts.views._go", return_value=None)
    def test_feed_does_not_show_unfollowed_posts(self, mock_go):
        stranger = make_user("stranger")
        make_post(stranger, "Stranger post")
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/posts/")
        usernames = [p["author"]["username"] for p in response.data["results"]]
        self.assertNotIn("stranger", usernames)


class CreatePostTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("poster")

    @patch("apps.posts.views._go", return_value=None)
    @patch("apps.posts.views._invalidate_follower_caches")
    def test_create_post_returns_201(self, mock_inv, mock_go):
        self.client.force_authenticate(user=self.user)
        response = self.client.post("/api/posts/create/", {
            "content": "Hello world!"
        }, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Post.objects.count(), 1)

    @patch("apps.posts.views._go", return_value=None)
    @patch("apps.posts.views._invalidate_follower_caches")
    def test_created_post_belongs_to_user(self, mock_inv, mock_go):
        self.client.force_authenticate(user=self.user)
        response = self.client.post("/api/posts/create/", {
            "content": "My post"
        }, format="multipart")
        self.assertEqual(response.data["author"]["username"], "poster")

    def test_create_post_unauthenticated_returns_401(self):
        response = self.client.post("/api/posts/create/", {"content": "Test"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class PostDetailTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("postowner")
        self.other = make_user("otheruser")
        self.post = make_post(self.user)

    @patch("apps.posts.views._go", return_value=None)
    def test_get_post_returns_200(self, mock_go):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f"/api/posts/{self.post.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["content"], self.post.content)

    @patch("apps.posts.views._go", return_value=None)
    def test_get_nonexistent_post_returns_404(self, mock_go):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/posts/9999/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch("apps.posts.views._invalidate_follower_caches")
    def test_owner_can_delete_post(self, mock_inv):
        self.client.force_authenticate(user=self.user)
        response = self.client.delete(f"/api/posts/{self.post.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Post.objects.count(), 0)

    @patch("apps.posts.views._invalidate_follower_caches")
    def test_non_owner_cannot_delete_post(self, mock_inv):
        self.client.force_authenticate(user=self.other)
        response = self.client.delete(f"/api/posts/{self.post.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Post.objects.count(), 1)


class LikeToggleTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("liker")
        self.post = make_post(make_user("author"))

    @patch("apps.posts.views._go", return_value=None)
    def test_like_post_returns_liked_true(self, mock_go):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(f"/api/posts/{self.post.id}/like/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["liked"])
        self.assertEqual(Like.objects.count(), 1)

    @patch("apps.posts.views._go", return_value=None)
    def test_unlike_post_returns_liked_false(self, mock_go):
        Like.objects.create(post=self.post, user=self.user)
        self.client.force_authenticate(user=self.user)
        response = self.client.post(f"/api/posts/{self.post.id}/like/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["liked"])
        self.assertEqual(Like.objects.count(), 0)

    def test_like_unauthenticated_returns_401(self):
        response = self.client.post(f"/api/posts/{self.post.id}/like/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class SaveToggleTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("saver")
        self.post = make_post(make_user("author"))

    def test_save_post_returns_saved_true(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(f"/api/posts/{self.post.id}/save/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["saved"])
        self.assertEqual(Save.objects.count(), 1)

    def test_unsave_post_returns_saved_false(self):
        Save.objects.create(post=self.post, user=self.user)
        self.client.force_authenticate(user=self.user)
        response = self.client.post(f"/api/posts/{self.post.id}/save/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["saved"])
        self.assertEqual(Save.objects.count(), 0)


class CommentsTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("commenter")
        self.post = make_post(make_user("author"))

    @patch("apps.posts.views._go", return_value=None)
    def test_add_comment_returns_201(self, mock_go):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(f"/api/posts/{self.post.id}/comments/", {
            "content": "Nice post!"
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Comment.objects.count(), 1)

    def test_get_comments_returns_200(self):
        Comment.objects.create(post=self.post, author=self.user, content="Test comment")
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f"/api/posts/{self.post.id}/comments/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_owner_can_delete_comment(self):
        comment = Comment.objects.create(post=self.post, author=self.user, content="Test")
        self.client.force_authenticate(user=self.user)
        response = self.client.delete(f"/api/posts/comments/{comment.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Comment.objects.count(), 0)

    def test_non_owner_cannot_delete_comment(self):
        other = make_user("otheruser")
        comment = Comment.objects.create(post=self.post, author=self.user, content="Test")
        self.client.force_authenticate(user=other)
        response = self.client.delete(f"/api/posts/comments/{comment.id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class SearchPostsTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("searcher")
        make_post(self.user, "Django is awesome")
        make_post(self.user, "Python rocks")

    def test_search_returns_matching_posts(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/posts/search/?q=Django")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_search_empty_query_returns_empty(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/posts/search/?q=")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)