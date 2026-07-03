import { Link } from 'react-router-dom'

export function Home() {
    return (
        <>
            <div className="wrapper">
                <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237c3aed' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z'/><path d='M14 2v5a1 1 0 0 0 1 1h5'/><path d='M10 9H8'/><path d='M16 13H8'/><path d='M16 17H8'/></svg>"></link>                <div className="container">
                    <h1>Document Intelligence Platform</h1>
                    <p className="subtitle">Upload, process, and explore documents with AI</p>
                </div>
            </div>

            <div className="content">
                <p>Upload your documents and books to get AI-powered summaries, insights, and reading recommendations — all in one place.</p>
            </div>

            <div className="nav-links">
                <Link to="/upload" className="nav-card">
                    <span className="nav-icon">↑</span>
                    <span className="nav-label">Upload</span>
                    <span className="nav-desc">Add a new document or book</span>
                </Link>
                <Link to="/library" className="nav-card">
                    <span className="nav-icon">☰</span>
                    <span className="nav-label">Library</span>
                    <span className="nav-desc">View your uploaded files</span>
                </Link>
                <Link to="/ask" className="nav-card">
                    <span className="nav-icon">?</span>
                    <span className="nav-label">Ask</span>
                    <span className="nav-desc">Chat about your documents</span>
                </Link>
            </div>
        </>
    );
}