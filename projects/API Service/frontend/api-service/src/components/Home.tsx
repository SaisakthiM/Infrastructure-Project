import { Link } from "react-router-dom"
import "./Home.css"

export function Home() {
    return (
        <div className="home-wrapper">
            <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23f59e0b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M12 2v2'/><path d='m4.93 4.93 1.41 1.41'/><path d='M20 12h2'/><path d='m19.07 4.93-1.41 1.41'/><path d='M15.947 12.65a4 4 0 0 0-5.925-4.128'/><path d='M3 20a5 5 0 1 1 8.9-4H13a3 3 0 0 1 2 5.24'/><path d='M11 20v2'/><path d='M7 19v2'/></svg>"></link>
            
            <div className="home-container">
                <div className="hero">
                    <span className="badge">v1.0</span>
                    <h1>API Service</h1>
                    <p className="subtitle">
                        A unified interface for fetching weather and location data.
                        Use Geocoding to convert a city into coordinates, then pass
                        them into the Weather API.
                    </p>
                </div>

                <div className="note-card">
                    <span className="note-icon">💡</span>
                    <p>Weather API requires latitude & longitude. Use the <strong>Geocoding API</strong> first to get coordinates from a city name.</p>
                </div>

                <div className="api-grid">
                    <Link to="/geo/cod" className="api-card">
                        <div className="api-card-icon">🌐</div>
                        <div className="api-card-content">
                            <h2 id="geocod">Geocoding API</h2>
                            <p>Convert a city name, state, and country code into latitude and longitude coordinates.</p>
                        </div>
                        <span className="api-card-arrow">→</span>
                    </Link>

                    <Link to="/weather" className="api-card">
                        <div className="api-card-icon">🌤️</div>
                        <div className="api-card-content">
                            <h2>Weather API</h2>
                            <p>Fetch real-time weather data for any location using its coordinates.</p>
                        </div>
                        <span className="api-card-arrow">→</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}