import { useState, useRef } from "react";

export default function Upload() {
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef();

  async function handleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch("/video/api/upload", { method: "POST", body: formData });
      const text = await res.text();
      setStatus(text);
      setStatusType("success");
      setFileName("");
    } catch (err) {
      setStatus("Upload failed: " + err.message);
      setStatusType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrapper">
      <div className="container">
        <h1>Upload</h1>
        <h2>Select a file to upload to the server</h2>
        <hr />
        <form onSubmit={handleSubmit} id="form" encType="multipart/form-data">
          <div className="upload-zone" onClick={() => fileRef.current.click()}>
            <label>Click to select a file</label>
            <input
              ref={fileRef}
              type="file"
              name="fileToUpload"
              id="image-upload"
              onChange={(e) => setFileName(e.target.files[0]?.name || "")}
            />
            {fileName
              ? <p className="file-name">{fileName}</p>
              : <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No file selected</p>
            }
          </div>
          <button className="btn" type="submit" disabled={loading || !fileName}>
            {loading ? "Uploading..." : "Upload File"}
          </button>
        </form>
        {status && (
          <div className={`status ${statusType}`}>{status}</div>
        )}
      </div>
    </div>
  );
}