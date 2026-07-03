import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { createBook } from "../scripts/Handler.js";

export function Upload() {
    const [formData, setFormData] = useState({
        title: "",
        author: "",
        rating: 0,
        description: "",
    });
    const [hoveredStar, setHoveredStar] = useState(0);
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState(null); // "loading" | "success" | "error"
    const [errorMsg, setErrorMsg] = useState("");

    const onDrop = useCallback((acceptedFiles) => {
        setFile(acceptedFiles[0]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { "application/pdf": [".pdf"], "application/epub+zip": [".epub"] },
        maxFiles: 1,
    });

    const handleChange = (e) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus("loading");
        setErrorMsg("");

        try {
            // If you add MinIO later, upload file here first and get back a URL
            // const url = await uploadFileToMinio(file);
            const url = null; // placeholder until MinIO is set up

            await createBook({ ...formData, url });
            setStatus("success");
            setFormData({ title: "", author: "", rating: 0, description: "" });
            setFile(null);
        } catch (err) {
            setStatus("error");
            setErrorMsg(err.message);
        }
    };

    return (
        <>
            <div className="wrapper">
                <div className="container">
                    <h1>Upload a Document</h1>
                    <p className="subtitle">Add a book or document to your library</p>
                </div>
            </div>

            <form className="form-card" onSubmit={handleSubmit}>

                {status === "success" && (
                    <div className="form-banner form-banner--success">
                        Book uploaded successfully!
                    </div>
                )}
                {status === "error" && (
                    <div className="form-banner form-banner--error">
                        {errorMsg || "Something went wrong."}
                    </div>
                )}

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Title</label>
                        <input
                            className="form-input"
                            type="text"
                            name="title"
                            placeholder="e.g. Atomic Habits"
                            value={formData.title}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Author</label>
                        <input
                            className="form-input"
                            type="text"
                            name="author"
                            placeholder="e.g. James Clear"
                            value={formData.author}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Rating</label>
                    <div className="star-row">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <span
                                key={star}
                                className={`star ${star <= (hoveredStar || formData.rating) ? "star--active" : ""}`}
                                onClick={() => setFormData((prev) => ({ ...prev, rating: star }))}
                                onMouseEnter={() => setHoveredStar(star)}
                                onMouseLeave={() => setHoveredStar(0)}
                            >
                                ★
                            </span>
                        ))}
                        <span className="star-label">
                            {formData.rating ? `${formData.rating} / 5` : "No rating"}
                        </span>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                        className="form-input form-textarea"
                        name="description"
                        placeholder="A short summary or your thoughts..."
                        value={formData.description}
                        onChange={handleChange}
                        rows={4}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">File</label>
                    <div {...getRootProps()} className={`dropzone ${isDragActive ? "dropzone--active" : ""} ${file ? "dropzone--filled" : ""}`}>
                        <input {...getInputProps()} />
                        {file ? (
                            <>
                                <span className="dropzone-icon">✓</span>
                                <p className="dropzone-text">{file.name}</p>
                                <p className="dropzone-hint">Click or drop to replace</p>
                            </>
                        ) : isDragActive ? (
                            <>
                                <span className="dropzone-icon">↓</span>
                                <p className="dropzone-text">Drop it here</p>
                            </>
                        ) : (
                            <>
                                <span className="dropzone-icon">↑</span>
                                <p className="dropzone-text">Drag & drop your file here</p>
                                <p className="dropzone-hint">PDF or EPUB · Click to browse</p>
                            </>
                        )}
                    </div>
                </div>

                <button
                    className="form-submit"
                    type="submit"
                    disabled={status === "loading"}
                >
                    {status === "loading" ? "Uploading..." : "Upload Document"}
                </button>
            </form>
        </>
    );
}