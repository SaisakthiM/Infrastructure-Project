from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from api.models import Note
from django.utils import timezone
from datetime import timedelta


class NoteModelTest(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            password="TestPass123!"
        )
        self.note = Note.objects.create(
            owner=self.user,
            title="Test Note",
            content="Test Content",
            importance="medium"
        )

    def test_note_str_returns_title(self):
        self.assertEqual(str(self.note), "Test Note")

    def test_note_default_importance_is_medium(self):
        note = Note.objects.create(
            owner=self.user,
            title="Default Importance"
        )
        self.assertEqual(note.importance, "medium")

    def test_note_created_at_is_set(self):
        self.assertIsNotNone(self.note.created_at)

    def test_deleting_user_deletes_notes(self):
        self.user.delete()
        self.assertEqual(Note.objects.count(), 0)

    def test_note_content_can_be_blank(self):
        note = Note.objects.create(
            owner=self.user,
            title="No Content Note",
        )
        self.assertEqual(note.content, "")

    def test_note_deadline_can_be_null(self):
        note = Note.objects.create(
            owner=self.user,
            title="No Deadline"
        )
        self.assertIsNone(note.deadline)


class NoteViewSetTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username="user1",
            password="TestPass123!"
        )
        self.user2 = User.objects.create_user(
            username="user2",
            password="TestPass123!"
        )
        self.note = Note.objects.create(
            owner=self.user1,
            title="User1 Note",
            content="Private content",
            importance="high"
        )

    # ── Authentication ────────────────────────────────────────
    def test_unauthenticated_cannot_list_notes(self):
        response = self.client.get("/api/notes/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unauthenticated_cannot_create_note(self):
        response = self.client.post("/api/notes/", {
            "title": "Hacked Note",
            "content": "Should not work"
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── List ──────────────────────────────────────────────────
    def test_authenticated_user_can_list_notes(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get("/api/notes/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_user_only_sees_own_notes(self):
        # user2 has no notes
        self.client.force_authenticate(user=self.user2)
        response = self.client.get("/api/notes/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_user1_sees_only_their_notes(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get("/api/notes/")
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "User1 Note")

    # ── Create ────────────────────────────────────────────────
    def test_authenticated_user_can_create_note(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post("/api/notes/", {
            "title": "New Note",
            "content": "New Content",
            "importance": "low"
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Note.objects.count(), 2)

    def test_created_note_belongs_to_authenticated_user(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post("/api/notes/", {
            "title": "My Note",
            "content": "My Content",
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        note = Note.objects.get(id=response.data["id"])
        self.assertEqual(note.owner, self.user1)

    def test_create_note_without_title_fails(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post("/api/notes/", {
            "content": "No title here"
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_note_with_deadline(self):
        self.client.force_authenticate(user=self.user1)
        deadline = (timezone.now() + timedelta(days=7)).isoformat()
        response = self.client.post("/api/notes/", {
            "title": "Deadline Note",
            "content": "Has a deadline",
            "deadline": deadline,
            "importance": "high"
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(response.data["deadline"])

    # ── Retrieve ──────────────────────────────────────────────
    def test_user_can_retrieve_own_note(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(f"/api/notes/{self.note.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "User1 Note")

    def test_user_cannot_retrieve_another_users_note(self):
        self.client.force_authenticate(user=self.user2)
        response = self.client.get(f"/api/notes/{self.note.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ── Update ────────────────────────────────────────────────
    def test_user_can_update_own_note(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.patch(f"/api/notes/{self.note.id}/", {
            "title": "Updated Title"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Updated Title")

    def test_user_cannot_update_another_users_note(self):
        self.client.force_authenticate(user=self.user2)
        response = self.client.patch(f"/api/notes/{self.note.id}/", {
            "title": "Hacked Title"
        })
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ── Delete ────────────────────────────────────────────────
    def test_user_can_delete_own_note(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.delete(f"/api/notes/{self.note.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Note.objects.count(), 0)

    def test_user_cannot_delete_another_users_note(self):
        self.client.force_authenticate(user=self.user2)
        response = self.client.delete(f"/api/notes/{self.note.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Note.objects.count(), 1)

    # ── Importance choices ────────────────────────────────────
    def test_invalid_importance_fails(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post("/api/notes/", {
            "title": "Bad Importance",
            "importance": "critical"  # not a valid choice
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)