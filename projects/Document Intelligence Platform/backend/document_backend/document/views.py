from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Book
from .serializers import BookSerializer
from .services import generate_summary, get_recommendations, get_embedding, upload_to_minio


class BookListView(APIView):
    def get(self, request):
        books = Book.objects.all()
        serializer = BookSerializer(books, many=True)
        return Response(serializer.data)
    
    def post(self, request):
        file = request.FILES.get("file")
        url = upload_to_minio(file) if file else None

        data = request.data.copy()
        data["url"] = url

        serializer = BookSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


class BookDetailView(APIView):
    def get(self, request, id):
        try:
            book = Book.objects.get(id=id)
            serializer = BookSerializer(book)
            return Response(serializer.data)
        except Book.DoesNotExist:
            return Response({"error": "Not found"}, status=404)

class SummarizeBookView(APIView):
    def post(self, request, id):
        try:
            book = Book.objects.get(id=id)

            # Cache check
            if book.summary:
                print(book.summary)
                return Response({
                    "summary": book.summary,
                    "summary_source": book.summary_source,
                    "cached": True
                })

            model_choice = request.data.get("model", "ollama")

            prompt = f"""
            Summarize the following book clearly:

            Title: {book.title}
            Author: {book.author}
            Description: {book.description}
            """

            summary, source = generate_summary(prompt, model_choice)

            if not summary:
                return Response({"error": "Failed to generate summary"}, status=500)

            # Save result
            book.summary = summary
            book.summary_source = source
            book.save()

            return Response({
                "summary": summary,
                "summary_source": source,
                "cached": False
            })

        except Book.DoesNotExist:
            return Response({"error": "Book not found"}, status=404)

        except Exception as e:
            return Response({"error": str(e)}, status=500)

class RecommendationView(APIView):
    def get(self, request, id):
        try:
            target_book = Book.objects.get(id=id)
            all_books = Book.objects.all()

            recommended = get_recommendations(target_book, all_books)

            serializer = BookSerializer(recommended, many=True)

            return Response({
                "recommendations": serializer.data
            })

        except Book.DoesNotExist:
            return Response({"error": "Book not found"}, status=404)

# views.py
class AskQuestionView(APIView):
    def post(self, request):
        book_id = request.data.get("book_id")
        question = request.data.get("question")
        history = request.data.get("history", [])

        try:
            book = Book.objects.get(id=book_id)
        except Book.DoesNotExist:
            return Response({"error": "Book not found"}, status=404)

        context = f"""
        Title: {book.title}
        Author: {book.author or 'Unknown'}
        Rating: {book.rating or 'N/A'}
        Description: {book.description or 'N/A'}
        Summary: {book.summary or 'N/A'}
        Genre: {book.genre or 'N/A'}
        """

        prompt = f"""
        You are an assistant helping a user understand a book.

        Book details:
        {context}

        You have access to internet. Search the details if the given information is low
        Question: {question}
        """

        answer, _ = generate_summary(prompt, model_choice="ollama")
        return Response({"answer": answer})
