import { Link } from "react-router-dom"
import "./Home.css"

export function Home() {
    return (
        <div className="home-wrapper city-ui">
            <div className="home-container">
                <div className="hero">
                    <span className="badge">v2.0</span>
                    <h1>API Service</h1>
                    <p className="subtitle">
                        Weather, places, markets and live world data in one place.
                        Use Geocoding to convert a city into coordinates, then pass
                        them into the Weather API. Trade city companies on the Exchange with your bank account.
                    </p>
                </div>

                <div className="note-card glass">
                    <span className="note-icon">💡</span>
                    <p>Weather API requires latitude &amp; longitude. Use the <strong>Geocoding API</strong> first to get coordinates from a city name.</p>
                </div>

                <div className="api-grid">
                    <Link to="/geo/cod" className="api-card glass">
                        <div className="api-card-icon">🌐</div>
                        <div className="api-card-content">
                            <h2 id="geocod">Geocoding API</h2>
                            <p>Convert a city name, state, and country code into latitude and longitude coordinates.</p>
                        </div>
                        <span className="api-card-arrow">→</span>
                    </Link>

                    <Link to="/weather" className="api-card glass">
                        <div className="api-card-icon">🌤️</div>
                        <div className="api-card-content">
                            <h2>Weather API</h2>
                            <p>Fetch real-time weather data for any location using its coordinates.</p>
                        </div>
                        <span className="api-card-arrow">→</span>
                    </Link>

                    <Link to="/world" className="api-card glass">
                        <div className="api-card-icon">🛰️</div>
                        <div className="api-card-content">
                            <h2>World Globe</h2>
                            <p>Earthquakes, the space station and the forecast for any city, on a 3D Earth.</p>
                        </div>
                        <span className="api-card-arrow">→</span>
                    </Link>

                    <Link to="/markets" className="api-card glass">
                        <div className="api-card-icon">📈</div>
                        <div className="api-card-content">
                            <h2>Markets</h2>
                            <p>Real-world stocks, crypto and currency rates from free public providers.</p>
                        </div>
                        <span className="api-card-arrow">→</span>
                    </Link>

                    <Link to="/exchange" className="api-card glass">
                        <div className="api-card-icon">🏙️</div>
                        <div className="api-card-content">
                            <h2>City Exchange</h2>
                            <p>Buy and sell shares in the city's companies. Paid from your city bank account.</p>
                        </div>
                        <span className="api-card-arrow">→</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}
