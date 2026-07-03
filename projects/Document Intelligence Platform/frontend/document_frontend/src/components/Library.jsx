import { useState, useEffect } from "react";
import { getBooks, summarizeBook } from "../scripts/Handler.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const BASE_URL = "/document/api";

async function fetchRecommendations(bookId) {
    const response = await fetch(`${BASE_URL}/books/${bookId}/recommendations/`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Failed to fetch recommendations");
    return data.recommendations;
}

function BookIcon() {
    return (
        <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="book-svg-icon"
        >
            <rect x="8" y="6" width="24" height="30" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <line x1="13" y1="13" x2="27" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="13" y1="18" x2="27" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="13" y1="23" x2="21" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="8" y="6" width="4" height="30" rx="1" fill="currentColor" opacity="0.15" />
        </svg>
    );
}

function BookCard({ book, onRecommend, onSummarize }) {
    return (
        <div className="lib-card">
            <div className="lib-card-cover">
                {book.cover_image ? (
                    <img src={book.cover_image} alt={book.title} className="lib-card-img" />
                ) : (
                    <div className="lib-card-placeholder">
                        <BookIcon />
                    </div>
                )}
            </div>
            <div className="lib-card-body">
                <p className="lib-card-title">{book.title}</p>
                {book.author && (
                    <p className="book-item-author">{book.author}</p>
                )}
                {book.rating > 0 && (
                    <p className="book-item-rating">
                        {"★".repeat(Math.round(book.rating))}{"☆".repeat(5 - Math.round(book.rating))}
                        <span className="star-label">{book.rating}/5</span>
                    </p>
                )}
                {book.genre && (
                    <span className="lib-card-genre">{book.genre}</span>
                )}
                {book.description && (
                    <p className="lib-card-desc">{book.description}</p>
                )}
                <div className="lib-card-actions">
                    {book.url && (
                        <a
                            href={book.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="chat-context-reset lib-btn-link"
                        >
                            View File
                        </a>
                    )}
                    <button
                        className="form-submit lib-btn-recommend"
                        onClick={() => onRecommend(book)}
                    >
                        Recommend
                    </button>
                    <button
                        className="form-submit lib-btn-recommend"
                        onClick={() => onSummarize(book)}
                    >
                        Summarize
                    </button>
                </div>
            </div>
        </div>
    );
}

function RecommendModal({ book, onClose }) {
    const [recs, setRecs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchRecommendations(book.id)
            .then(setRecs)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [book.id]);

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="chat-context-bar">
                    <div className="chat-context-info">
                        <span className="chat-context-title">Recommendations</span>
                        <span className="chat-context-author">Based on "{book.title}"</span>
                    </div>
                    <button className="chat-context-reset" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    {loading && <p className="sidebar-empty">Finding similar books…</p>}
                    {error && <div className="form-banner form-banner--error">{error}</div>}
                    {!loading && !error && recs.length === 0 && (
                        <p className="sidebar-empty">No recommendations found.</p>
                    )}
                    {!loading && !error && recs.map((rec) => (
                        <div key={rec.id} className="rec-item">
                            <div className="rec-icon-wrap"><BookIcon /></div>
                            <div className="rec-info">
                                <p className="lib-card-title">{rec.title}</p>
                                {rec.author && <p className="book-item-author">{rec.author}</p>}
                                {rec.description && <p className="lib-card-desc">{rec.description}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function SummaryModal({ book, onClose }) {
    const [summary, setSummary] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        summarizeBook(book.id)
            .then((data) => setSummary(data.summary))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [book.id]);

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="chat-context-bar">
                    <div className="chat-context-info">
                        <span className="chat-context-title">Summary</span>
                        <span className="chat-context-author">{book.title}</span>
                    </div>
                    <button className="chat-context-reset" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    {loading && <p className="sidebar-empty">Generating summary…</p>}
                    {error && <div className="form-banner form-banner--error">{error}</div>}
                    {!loading && !error && (
                        <div className="chat-bubble-text">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function Library() {
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedBook, setSelectedBook] = useState(null);
    const [search, setSearch] = useState("");
    const [summaryBook, setSummaryBook] = useState(null);

    useEffect(() => {
        getBooks()
            .then(setBooks)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    const filtered = books.filter(
        (b) =>
            b.title.toLowerCase().includes(search.toLowerCase()) ||
            (b.author || "").toLowerCase().includes(search.toLowerCase())
    );

    return (
        <>
            <div className="wrapper">
                <div className="container">
                    <h1>Your Library</h1>
                    <p className="subtitle">Browse and explore your uploaded documents</p>
                </div>
            </div>

            <div className="lib-toolbar">
                <input
                    className="form-input lib-search"
                    type="text"
                    placeholder="Search by title or author…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {loading && <p className="sidebar-empty lib-state">Loading your library…</p>}
            {error && <div className="form-banner form-banner--error lib-state">{error}</div>}
            {!loading && !error && filtered.length === 0 && (
                <p className="sidebar-empty lib-state">
                    {books.length === 0
                        ? "No books yet. Upload one to get started."
                        : "No results match your search."}
                </p>
            )}

            {!loading && !error && filtered.length > 0 && (
                <div className="lib-grid">
                    {filtered.map((book) => (
                        <BookCard key={book.id} book={book} onRecommend={setSelectedBook} onSummarize={setSummaryBook} />
                    ))}
                </div>
            )}

            {selectedBook && (
                <RecommendModal book={selectedBook} onClose={() => setSelectedBook(null)} />
            )}
            {summaryBook && (
                <SummaryModal book={summaryBook} onClose={() => setSummaryBook(null)} />
            )}
        </>
    );
}