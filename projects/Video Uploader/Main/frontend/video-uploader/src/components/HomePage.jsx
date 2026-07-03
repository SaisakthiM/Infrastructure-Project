import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="wrapper">
      <div className="container">
        <h1>File Uploader</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Upload, download, or remove files stored locally and on your server.
        </p>
        <hr />
        <ul className="nav-list">
          <li>
            <Link to="/upload">
              <span>Upload a file <span className="tag">POST</span></span>
              <span className="arrow">→</span>
            </Link>
          </li>
          <li>
            <Link to="/download">
              <span>Download a file <span className="tag">GET</span></span>
              <span className="arrow">→</span>
            </Link>
          </li>
          <li>
            <Link to="/remove">
              <span>Remove a file <span className="tag">DEL</span></span>
              <span className="arrow">→</span>
            </Link>
          </li>
        </ul>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Files are stored locally and backed up to OMV via SFTP for redundancy.
        </p>
      </div>
    </div>
  );
}