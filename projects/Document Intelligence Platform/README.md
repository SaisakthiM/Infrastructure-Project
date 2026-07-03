# Document Intelligence Platform

This is a Full Stack Project with AI Intergration to upload, view, and ask about the book with AI. 

---

# Features

### Book Management

* Upload and store books with metadata
* View book details (title, author, description, rating)

### AI Insights

* **Summary Generation** (Ollama / Gemini)
* **Recommendation System** (embedding-based similarity)
* Intelligent fallback mechanism between models

### Recommendation Engine

* Uses **Sentence Transformers**
* Computes **cosine similarity**
* Returns top similar books

### Summary Flow

* Uses Ollama and Gemini as fallback to summarize the book 
* The summary is also cached by uploading it to the database
* It is generated in markdown style and used react-markdown to render

### Q&A System (RAG-style)

* Ask questions about books
* Uses contextual prompt construction
* Supports conversation history

### Frontend

* React-based UI
* Markdown rendering for AI responses (react-markdown module)

---

# Tech Stack

### Backend

* Django REST Framework
* MySQL (metadata storage)
* Sentence Transformers (embeddings)
* Ollama (local LLM)
* Gemini API (fallback AI)

### Frontend

* ReactJS
* Tailwind CSS
* React Markdown + Remark GFM

### Storage

* MinIO (file storage)

---

## Setup Instructions


### 1. Clone the Repository

```bash
git clone https://github.com/SaisakthiM/Document-Intelligence-Platform
cd project
```

---

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Create `.env` file:

```env
PASSWORD_DATABASE=saisakthi2008
PORT_AI=11434
GEMINI_API_KEY=USE_YOUR_OWN_KEY
MINIO_ENDPOINT = "localhost:9000"
MINIO_ACCESS_KEY = "admin"
MINIO_SECRET_KEY = "password123"
MINIO_BUCKET = "documents"
MINIO_SECURE = False
```

Run server:

```bash
python manage.py migrate
python manage.py runserver
```

---

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

### 4. Run Ollama (for local AI)

```bash
ollama run phi3
```

---

### 5. Run Minio 

```bash
cd storage/minio
chmod +x runner.sh
./runner.sh
```

---

### 6. Create Minio Bucket 

```
After running it, redirect to localhost:9001 and use the user and password
in the .env and login. then create the bucket
```

---

## API Endpoints

### Books

| Method | Endpoint       | Description      |
| ------ | -------------- | ---------------- |
| GET    | `/books/`      | List all books   |
| POST   | `/books/`      | Upload book      |
| GET    | `/books/<id>/` | Get book details |

---

### AI Features

| Method | Endpoint                       | Description         |
| ------ | ------------------------------ | ------------------- |
| POST   | `/books/<id>/summarize/`       | Generate summary    |
| GET    | `/books/<id>/recommendations/` | Get similar books   |
| POST   | `/ask/`                        | Ask questions (RAG) |

---

## Sample Output

### Summary

```json
{
  "summary": "Atomic Habits focuses on building small, consistent habits...",
  "summary_source": "ollama"
}
```

---

### Recommendations

```json
{
  "recommendations": [
    { "title": "Deep Work" },
    { "title": "The Power of Habit" }
  ]
}
```

---

## Screenshots

* Home Screen

> ![alt text](image.png)

* Book List Page

> ![alt text](image-1.png)

* Summary Modal

> ![alt text](image-2.png)

* Recommendation Modal

> ![alt text](image-3.png)

* Ask Questions 

> ![alt text](image-4.png)

---

## Key Concepts Implemented

* Embedding-based similarity search
* AI fallback architecture
* Prompt engineering
* Modular service layer
* Basic RAG pipeline

---

## Future Improvements

* Full vector database integration (ChromaDB / FAISS)
* Chat history persistence
* Better UI/UX enhancements
* Advanced semantic chunking
* External data enrichment APIs

---

## Author

Saisakthi

---
