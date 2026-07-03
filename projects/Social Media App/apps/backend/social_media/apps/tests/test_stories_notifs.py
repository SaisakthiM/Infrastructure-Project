from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile
from apps.stories.models import Story, StoryView
from apps.notifications.models import Notification
from apps.messages.models import Conversation, Message
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


# ── STORIES ──────────────────────────────────────────────────

class CreateStoryTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("storyteller")

    def test_create_story_with_image_returns_201(self):
        self.client.force_authenticate(user=self.user)
        media = SimpleUploadedFile("story.jpg", b"imgdata", content_type="image/jpeg")
        response = self.client.post("/api/stories/create/", {
            "media": media,
            "caption": "My story",
        }, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Story.objects.count(), 1)

    def test_create_story_without_media_returns_400(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post("/api/stories/create/", {
            "caption": "No media"
        }, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_story_unauthenticated_returns_401(self):
        response = self.client.post("/api/stories/create/", {})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class DeleteStoryTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("storyowner")
        self.other = make_user("otheruser")
        media = SimpleUploadedFile("s.jpg", b"data", content_type="image/jpeg")
        self.story = Story.objects.create(author=self.user, media=media)

    def test_owner_can_delete_story(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.delete(f"/api/stories/{self.story.id}/delete/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Story.objects.count(), 0)

    def test_non_owner_cannot_delete_story(self):
        self.client.force_authenticate(user=self.other)
        response = self.client.delete(f"/api/stories/{self.story.id}/delete/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Story.objects.count(), 1)


class ViewStoryTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("viewer")
        author = make_user("author")
        media = SimpleUploadedFile("s.jpg", b"data", content_type="image/jpeg")
        self.story = Story.objects.create(author=author, media=media)

    def test_view_story_creates_story_view(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(f"/api/stories/{self.story.id}/view/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["viewed"])
        self.assertEqual(StoryView.objects.count(), 1)

    def test_view_story_twice_does_not_duplicate(self):
        self.client.force_authenticate(user=self.user)
        self.client.post(f"/api/stories/{self.story.id}/view/")
        self.client.post(f"/api/stories/{self.story.id}/view/")
        self.assertEqual(StoryView.objects.count(), 1)


# ── NOTIFICATIONS ─────────────────────────────────────────────

class NotificationsTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("recipient")
        self.sender = make_user("sender")
        self.notif = Notification.objects.create(
            recipient=self.user,
            sender=self.sender,
            notif_type="like",
        )

    def test_list_notifications_returns_200(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/notifications/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["unread_count"], 1)

    def test_list_notifications_unauthenticated_returns_401(self):
        response = self.client.get("/api/notifications/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_mark_read_marks_all_as_read(self):
        self.client.force_authenticate(user=self.user)
        self.client.post("/api/notifications/read/")
        self.notif.refresh_from_db()
        self.assertTrue(self.notif.is_read)

    def test_unread_count_returns_correct_count(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/notifications/unread/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_unread_count_after_mark_read_is_zero(self):
        self.client.force_authenticate(user=self.user)
        self.client.post("/api/notifications/read/")
        response = self.client.get("/api/notifications/unread/")
        self.assertEqual(response.data["count"], 0)

    def test_user_only_sees_own_notifications(self):
        other = make_user("other")
        Notification.objects.create(recipient=other, sender=self.sender, notif_type="follow")
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/notifications/")
        self.assertEqual(len(response.data["results"]), 1)


# ── MESSAGES ─────────────────────────────────────────────────

class ConversationsTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user1 = make_user("user1")
        self.user2 = make_user("user2")

    def test_start_conversation_returns_200(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post("/api/messages/start/", {
            "username": "user2"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Conversation.objects.count(), 1)

    def test_start_conversation_twice_returns_same_conversation(self):
        self.client.force_authenticate(user=self.user1)
        self.client.post("/api/messages/start/", {"username": "user2"})
        self.client.post("/api/messages/start/", {"username": "user2"})
        self.assertEqual(Conversation.objects.count(), 1)

    def test_start_conversation_nonexistent_user_returns_404(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post("/api/messages/start/", {"username": "nobody"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_conversations_returns_200(self):
        conv = Conversation.objects.create()
        conv.participants.add(self.user1, self.user2)
        self.client.force_authenticate(user=self.user1)
        response = self.client.get("/api/messages/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_list_conversations_unauthenticated_returns_401(self):
        response = self.client.get("/api/messages/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class SendMessageTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user1 = make_user("sender")
        self.user2 = make_user("receiver")
        self.conv = Conversation.objects.create()
        self.conv.participants.add(self.user1, self.user2)

    def test_send_message_returns_201(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(f"/api/messages/{self.conv.id}/send/", {
            "content": "Hello!"
        }, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Message.objects.count(), 1)

    def test_send_empty_message_returns_400(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(f"/api/messages/{self.conv.id}/send/", {
            "content": ""
        }, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_participant_cannot_send_message(self):
        stranger = make_user("stranger")
        self.client.force_authenticate(user=stranger)
        response = self.client.post(f"/api/messages/{self.conv.id}/send/", {
            "content": "Intruding!"
        }, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_messages_marks_as_read(self):
        Message.objects.create(
            conversation=self.conv,
            sender=self.user1,
            content="Unread message",
            is_read=False,
        )
        self.client.force_authenticate(user=self.user2)
        self.client.get(f"/api/messages/{self.conv.id}/messages/")
        self.assertTrue(Message.objects.filter(is_read=True).exists())

    def test_sender_message_not_marked_as_read_by_self(self):
        msg = Message.objects.create(
            conversation=self.conv,
            sender=self.user1,
            content="My own message",
            is_read=False,
        )
        self.client.force_authenticate(user=self.user1)
        self.client.get(f"/api/messages/{self.conv.id}/messages/")
        msg.refresh_from_db()
        self.assertFalse(msg.is_read)