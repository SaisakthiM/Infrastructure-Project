import { useState, useEffect, useRef } from "react";
import { getBooks } from "../scripts/Handler.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const BASE_URL = "/document/api";

async function askQuestion(bookId, question, history = []) {
    const response = await fetch(`${BASE_URL}/ask/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book_id: bookId, question, history }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Failed to get answer");
    return data;
}

export function Ask() {
    const [books, setBooks] = useState([]);
    const [selectedBook, setSelectedBook] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [booksLoading, setBooksLoading] = useState(true);
    const bottomRef = useRef(null);

    useEffect(() => {
        getBooks()
            .then(setBooks)
            .catch(() => setBooks([]))
            .finally(() => setBooksLoading(false));
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    const handleSelectBook = (book) => {
        setSelectedBook(book);
        setMessages([
            {
                role: "assistant",
                text: `You're now asking about **${book.title}**${book.author ? ` by ${book.author}` : ""}. What would you like to know?`,
            },
        ]);
    };

    const handleSend = async () => {
        if (!input.trim() || !selectedBook || loading) return;

        const question = input.trim();
        setInput("");

        const updatedMessages = [...messages, { role: "user", text: question }];
        setMessages(updatedMessages);
        setLoading(true);

        try {
            const history = updatedMessages
                .slice(1)
                .map((m) => ({ role: m.role, content: m.text }));

            const data = await askQuestion(selectedBook.id, question, history);
            setMessages((prev) => [...prev, { role: "assistant", text: data.answer }]);
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", text: `Error: ${err.message}`, isError: true },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleReset = () => {
        setSelectedBook(null);
        setMessages([]);
        setInput("");
    };

    return (
        <>
            <div className="wrapper">
                <div className="container">
                    <h1>Ask About a Book</h1>
                    <p className="subtitle">
                        {selectedBook
                            ? `Chatting about: ${selectedBook.title}`
                            : "Select a document to start asking questions"}
                    </p>
                </div>
            </div>

            <div className="chat-layout">
                <aside className="book-sidebar">
                    <p className="sidebar-heading">Your Library</p>
                    {booksLoading ? (
                        <p className="sidebar-empty">Loading...</p>
                    ) : books.length === 0 ? (
                        <p className="sidebar-empty">No books uploaded yet.</p>
                    ) : (
                        books.map((book) => (
                            <button
                                key={book.id}
                                className={`book-item ${selectedBook?.id === book.id ? "book-item--active" : ""}`}
                                onClick={() => handleSelectBook(book)}
                            >
                                <span className="book-item-title">{book.title}</span>
                                {book.author && (
                                    <span className="book-item-author">{book.author}</span>
                                )}
                                {book.rating && (
                                    <span className="book-item-rating">{"★".repeat(Math.round(book.rating))} {book.rating}/5</span>
                                )}
                            </button>
                        ))
                    )}
                </aside>

                <div className="chat-panel">
                    {!selectedBook ? (
                        <div className="chat-empty">
                            <span className="chat-empty-icon">←</span>
                            <p>Pick a book from your library to begin</p>
                        </div>
                    ) : (
                        <>
                            <div className="chat-context-bar">
                                <div className="chat-context-info">
                                    <span className="chat-context-title">{selectedBook.title}</span>
                                    {selectedBook.author && (
                                        <span className="chat-context-author">by {selectedBook.author}</span>
                                    )}
                                </div>
                                <button className="chat-context-reset" onClick={handleReset}>
                                    Change
                                </button>
                            </div>

                            <div className="chat-messages">
                                {messages.map((msg, i) => (
                                    <div
                                        key={i}
                                        className={`chat-bubble chat-bubble--${msg.role} ${msg.isError ? "chat-bubble--error" : ""}`}
                                    >
                                        <span className="chat-bubble-role">
                                            {msg.role === "user" ? "You" : "AI"}
                                        </span>
                                        <div className="chat-bubble-text">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {msg.text}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                ))}

                                {loading && (
                                    <div className="chat-bubble chat-bubble--assistant">
                                        <span className="chat-bubble-role">AI</span>
                                        <p className="chat-bubble-text chat-typing">
                                            <span />
                                            <span />
                                            <span />
                                        </p>
                                    </div>
                                )}
                                <div ref={bottomRef} />
                            </div>

                            <div className="chat-input-row">
                                <textarea
                                    className="chat-input"
                                    placeholder="Ask anything about this book..."
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    rows={1}
                                    disabled={loading}
                                />
                                <button
                                    className="chat-send"
                                    onClick={handleSend}
                                    disabled={!input.trim() || loading}
                                >
                                    ↑
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}