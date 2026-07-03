from django.test import TestCase, Client
from unittest.mock import patch
from document.models import Book


class BookListViewTest(TestCase):

    def setUp(self):
        self.client = Client()
        self.book = Book.objects.create(
            title="Test Book",
            author="Test Author",
            description="A test description",
        )

    # ── BookListView GET ──────────────────────────────────────
    def test_home_page_returns_200(self):
        response = self.client.get("/books/")
        self.assertEqual(response.status_code, 200)

    def test_book_list_returns_all_books(self):
        response = self.client.get("/books/")
        self.assertEqual(len(response.data), 1)

    # ── BookDetailView GET ────────────────────────────────────
    def test_existing_book_returns_200(self):
        response = self.client.get(f"/books/{self.book.id}/")
        self.assertEqual(response.status_code, 200)

    def test_not_found_book_returns_404(self):
        response = self.client.get("/books/9999/")
        self.assertEqual(response.status_code, 404)

    def test_book_detail_returns_correct_title(self):
        response = self.client.get(f"/books/{self.book.id}/")
        self.assertEqual(response.data["title"], "Test Book")

    # ── BookListView POST ─────────────────────────────────────
    def test_can_publish_book(self):
        response = self.client.post("/books/", {
            "title": "New Book",
            "author": "New Author",
            "description": "Some description",
        }, content_type="application/json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Book.objects.count(), 2)

    def test_publish_book_without_title_fails(self):
        response = self.client.post("/books/", {
            "author": "No Title Author",
        }, content_type="application/json")
        self.assertEqual(response.status_code, 400)

    def test_can_publish_book_with_file(self):
        with patch('document.services.upload_to_minio') as mock_upload:
            mock_upload.return_value = "http://minio/test-file.pdf"
            response = self.client.post("/books/", {
                "title": "Book With File",
                "author": "Author",
                "description": "Description",
                "url": "http://minio/test-file.pdf"
            }, content_type="application/json")
            self.assertEqual(response.status_code, 201)

    # ── SummarizeBookView ─────────────────────────────────────
    def test_summarize_returns_cached_if_exists(self):
        self.book.summary = "Cached summary"
        self.book.summary_source = "ollama"
        self.book.save()

        response = self.client.post(f"/books/{self.book.id}/summarize/", {
            "model": "ollama"
        }, content_type="application/json")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["cached"])
        self.assertEqual(response.data["summary"], "Cached summary")

    """@patch('document.services.generate_summary', return_value=('Summary text here', 'ollama'))
    def test_summarize_generates_new_summary(self):
        with patch('document.services.generate_summary') as mock_summary:
            mock_summary.return_value = ("Generated summary", "ollama")

            response = self.client.post(f"/books/{self.book.id}/summarize/", {
                "model": "ollama"
            }, content_type="application/json")

            self.assertEqual(response.status_code, 200)
            self.assertFalse(response.data["cached"])
            self.assertEqual(response.data["summary"], "Generated summary")"""

    def test_summarize_nonexistent_book_returns_404(self):
        response = self.client.post("/books/9999/summarize/", {
            "model": "ollama"
        }, content_type="application/json")
        self.assertEqual(response.status_code, 404)

    # ── RecommendationView ────────────────────────────────────
    def test_recommendations_returns_200(self):
        with patch('document.services.get_recommendations') as mock_rec:
            mock_rec.return_value = []
            response = self.client.get(f"/books/{self.book.id}/recommendations/")
            self.assertEqual(response.status_code, 200)
            self.assertIn("recommendations", response.data)

    def test_recommendations_nonexistent_book_returns_404(self):
        response = self.client.get("/books/9999/recommendations/")
        self.assertEqual(response.status_code, 404)

    # ── AskQuestionView ───────────────────────────────────────
    """@patch('document.services.summarize_ollama', return_value='This book is about testing')
    def test_ask_question_returns_answer(self):
        with patch('document.services.generate_summary') as mock_summary:
            mock_summary.return_value = ("This book is about testing", "ollama")

            response = self.client.post("/ask/", {
                "book_id": self.book.id,
                "question": "What is this book about?"
            }, content_type="application/json")

            self.assertEqual(response.status_code, 200)
            self.assertIn("answer", response.data)
            self.assertEqual(response.data["answer"], "This book is about testing")"""

    def test_ask_question_nonexistent_book_returns_404(self):
        response = self.client.post("/ask/", {
            "book_id": 9999,
            "question": "What is this book about?"
        }, content_type="application/json")
        self.assertEqual(response.status_code, 404)

    def test_ask_question_with_history(self):
        with patch('document.services.generate_summary') as mock_summary:
            mock_summary.return_value = ("Follow up answer", "ollama")

            response = self.client.post("/ask/", {
                "book_id": self.book.id,
                "question": "Tell me more",
                "history": [
                    {"role": "user", "content": "What is this book about?"},
                    {"role": "assistant", "content": "It is about testing"}
                ]
            }, content_type="application/json")

            self.assertEqual(response.status_code, 200)
            self.assertIn("answer", response.data)