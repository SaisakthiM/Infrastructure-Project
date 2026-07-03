import requests
import os
import uuid
from dotenv import load_dotenv

load_dotenv()

PORT = os.getenv("PORT_AI", "11434")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "host.docker.internal")
OLLAMA_URL = f"http://{OLLAMA_HOST}:{PORT}/api/generate"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY")
MINIO_BUCKET = os.getenv("MINIO_BUCKET")
MINIO_SECURE = os.getenv("MINIO_SECURE", "False").lower() == "true"

# ── Lazy clients — only initialized when actually called ──────
_minio_client = None
_genai_client = None
_embedding_model = None


def _get_minio():
    global _minio_client
    if _minio_client is None:
        from minio import Minio
        _minio_client = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=MINIO_SECURE,
        )
    return _minio_client


def _get_genai():
    global _genai_client
    if _genai_client is None:
        from google import genai
        _genai_client = genai.Client(api_key=GEMINI_API_KEY)
    return _genai_client


def _get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedding_model


# ── Public functions ──────────────────────────────────────────

def get_embedding(text):
    return _get_embedding_model().encode(text)


def summarize_ollama(prompt: str, model: str = "phi3"):
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False
    }
    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=120)
        response.raise_for_status()
        return response.json().get("response")
    except requests.exceptions.RequestException as e:
        print(f"[OLLAMA ERROR]: {e}")
        return None


def summarize_gemini(prompt: str, model: str = "gemini-3-flash-preview"):
    try:
        response = _get_genai().models.generate_content(
            model=model,
            contents=prompt,
        )
        return response.text
    except Exception as e:
        print(f"[GEMINI ERROR]: {e}")
        return None


def generate_summary(prompt: str, model_choice: str = "ollama"):
    model_choice = model_choice.lower()

    if model_choice == "ollama":
        result = summarize_ollama(prompt)
        if result:
            return result.strip(), "ollama"
        result = summarize_gemini(prompt)
        if result:
            return result.strip(), "gemini_fallback"
        return None, "failed"

    elif model_choice == "gemini":
        result = summarize_gemini(prompt)
        if result:
            return result.strip(), "gemini"
        result = summarize_ollama(prompt)
        if result:
            return result.strip(), "ollama_fallback"
        return None, "failed"

    return None, "invalid_model"


def get_recommendations(target_book, all_books, top_k=3):
    from sklearn.metrics.pairwise import cosine_similarity

    target_text = f"{target_book.title} {target_book.description}"
    target_embedding = get_embedding(target_text)

    results = []
    for book in all_books:
        if book.id == target_book.id:
            continue
        text = f"{book.title} {book.description}"
        emb = get_embedding(text)
        score = cosine_similarity([target_embedding], [emb])[0][0]
        results.append((book, score))

    results.sort(key=lambda x: x[1], reverse=True)
    return [book for book, _ in results[:top_k]]


def upload_to_minio(file, filename=None):
    client = _get_minio()
    bucket = MINIO_BUCKET

    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)

    ext = os.path.splitext(file.name)[1]
    object_name = filename or f"{uuid.uuid4()}{ext}"

    client.put_object(
        bucket,
        object_name,
        file,
        length=file.size,
        content_type=file.content_type,
    )

    return f"http://{MINIO_ENDPOINT}/{bucket}/{object_name}"