from django.test import TestCase, Client
from django.contrib.auth.models import User
from blog.models import Post

class PostModelTest(TestCase):
    
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            password="TestPass123!"
        )
    
    def test_post_str_returns_title(self):
        post = Post.objects.create(
            title="My Post",
            content="Content",
            author=self.user
        )
        # YOUR TURN: what should str(post) return?
        # hint: look at your __str__ method

        self.assertEqual(str(post), post.title)

    def test_post_has_correct_author(self):
        post = Post.objects.create(
            title="My Post",
            content="Content",
            author=self.user
        )
        # YOUR TURN: assert post.author equals self.user
        self.assertEqual(post.author, self.user)


    def test_post_content_is_saved(self):
        post = Post.objects.create(
            title="My Post",
            content="Hello World",
            author=self.user
        )
        # YOUR TURN: assert content was saved correctly
        self.assertEqual(post.content, "Hello World")

    def test_post_created_at_is_set(self):
        post = Post.objects.create(
            title="My Post",
            content="Content",
            author=self.user
        )
        # YOUR TURN: assert created_at is not None
        # hint: use assertIsNotNone
        self.assertIsNotNone(post.created_at)

    def test_deleting_user_deletes_their_posts(self):
        Post.objects.create(
            title="My Post",
            content="Content",
            author=self.user
        )
        self.user.delete()
        self.assertEqual(Post.objects.count(), 0)

