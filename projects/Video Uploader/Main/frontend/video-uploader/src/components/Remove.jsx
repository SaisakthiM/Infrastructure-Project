import { use, Suspense, useState } from "react";
import getAll from "./Getter";

function FileList({ data, onRemoved }) {
  const result = use(data);
  const files = result?.data || [];

  if (files.length === 0) {
    return <p className="empty">No files found on the server.</p>;
  }

  return (
    <ol className="file-list">
      {files.map((item, index) => (
        <FileRow key={index} filename={item} onRemoved={onRemoved} />
      ))}
    </ol>
  );
}

function FileRow({ filename, onRemoved }) {
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState("");
  const [loading, setLoading] = useState(false);
  const [removed, setRemoved] = useState(false);

  async function handleRemove() {
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch(`/video/api/remove/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      const text = await res.text();
      if (res.ok) {
        setStatus(text);
        setStatusType("success");
        setRemoved(true);
        if (onRemoved) onRemoved(filename);
      } else {
        setStatus(text || "Remove failed.");
        setStatusType("error");
      }
    } catch (err) {
      setStatus("Remove failed: " + err.message);
      setStatusType("error");
    } finally {
      setLoading(false);
    }
  }

  if (removed) return null;

  return (
    <li style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span
          style={{
            flex: 1,
            padding: "0.7rem 0.9rem",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--text)",
            fontSize: "0.85rem",
            fontFamily: "'DM Mono', monospace",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {filename}
        </span>
        <button
          className="btn"
          onClick={handleRemove}
          disabled={loading}
          aria-label={`Remove ${filename}`}
          style={{
            width: "auto",
            padding: "0.7rem 1.1rem",
            background: "var(--danger)",
            flexShrink: 0,
          }}
        >
          {loading ? "Removing…" : "Remove"}
        </button>
      </div>
      {status && (
        <div className={`status ${statusType}`} style={{ marginTop: 0 }}>
          {status}
        </div>
      )}
    </li>
  );
}

async function getVal() {
  return await getAll();
}

export default function Remove() {
  const [refreshKey, setRefreshKey] = useState(0);

  function handleRemoved() {
    // bump key to re-fetch list after a removal
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="wrapper">
      <div className="container">
        <h1>Remove</h1>
        <h2>Select a file to permanently delete from the server</h2>
        <hr />
        <Suspense fallback={<p className="empty">Loading files…</p>}>
          <FileList
            key={refreshKey}
            data={getVal()}
            onRemoved={handleRemoved}
          />
        </Suspense>
      </div>
    </div>
  );
}