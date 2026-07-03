// All API calls go through the nginx gateway, not directly to the container
const BASE_URL = "/document/api";

async function request(path, options = {}) {
    const response = await fetch(`${BASE_URL}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.error || `Request failed: ${response.status}`);
    }

    return data;
}

// GET /books/
export async function getBooks() {
    return request("/books/");
}

// POST /books/
export async function createBook({ title, author, rating, description, file }) {
    const form = new FormData();
    form.append("title", title);
    if (author) form.append("author", author);
    if (rating) form.append("rating", rating);
    if (description) form.append("description", description);
    if (file) form.append("file", file);

    const response = await fetch(`${BASE_URL}/books/`, {
        method: "POST",
        body: form,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Upload failed");
    return data;
}

// GET /books/:id/
export async function getBook(id) {
    return request(`/books/${id}/`);
}

// DELETE /books/:id/
export async function deleteBook(id) {
    return request(`/books/${id}/`, { method: "DELETE" });
}

// POST /books/:id/summarize/
export async function summarizeBook(id, model = "gemini") {
    return request(`/books/${id}/summarize/`, {
        method: "POST",
        body: JSON.stringify({ model }),
    });
}

// GET /books/:id/recommendations/
export async function getRecommendations(id) {
    return request(`/books/${id}/recommendations/`);
}