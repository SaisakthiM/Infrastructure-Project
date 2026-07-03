import { useEffect, useState } from "react"
import axios from "axios"
import "./Weather.css"

type GeoResult = {
    lat: number;
    lon: number;
    name: string;
    country: string;
    state?: string;
}

export function GeoCod() {
    const [City, setCity] = useState("");
    const [State, setState] = useState("");
    const [Country, setCountry] = useState("");
    const [serverOnline, setServerOnline] = useState<boolean | null>(null);
    const [result, setResult] = useState<GeoResult | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const send = async () => {
        setLoading(true);
        setError("");
        setResult(null);
        try {
            const res = await axios.get(`/api-service/api/api/geo/cod/?city=${City}&state_code=${State}&country_code=${Country}`)

            if (!res.data || res.data.length === 0) {
                setError("Location not found. Check your inputs.");
                return;
            }

            const loc = res.data[0];
            setResult({
                lat: loc.lat,
                lon: loc.lon,
                name: loc.name,
                country: loc.country,
                state: loc.state,
            });
        } catch (e) {
            console.log(e);
            setError("Request failed.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const check = async () => {
            try {
                const res = await axios.get("/api-service/api/");
                setServerOnline(res.status === 200);
            } catch {
                setServerOnline(false);
            }
        };
        check();
    }, []);

    if (serverOnline === null) return <div className="status-msg">Checking server...</div>;

    if (serverOnline) {
        return (
            <div className="wrapper">
                <div className="container">
                    <h1>Geocoding API</h1>
                    <p>Enter a city name and its state/country codes to get the latitude and longitude.</p>

                    <form>
                        <div className="field">
                            <label>City Name</label>
                            <input
                                type="text"
                                value={City}
                                placeholder="e.g. Chennai"
                                onChange={(e) => setCity(e.target.value)}
                            />
                        </div>
                        <div className="field">
                            <label>State Code</label>
                            <input
                                type="text"
                                value={State}
                                placeholder="e.g. TN (optional)"
                                onChange={(e) => setState(e.target.value)}
                            />
                        </div>
                        <div className="field">
                            <label>Country Code</label>
                            <input
                                type="text"
                                value={Country}
                                placeholder="e.g. IN"
                                onChange={(e) => setCountry(e.target.value)}
                            />
                        </div>
                        <input type="button" id="sub_button" onClick={send} value={loading ? "Loading..." : "Submit"} />
                    </form>

                    <div className={`response-card ${result ? "active" : ""}`}>
                        {!result && !error && (
                            <p className="response-placeholder">Results will appear here...</p>
                        )}
                        {error && <p className="response-error">{error}</p>}
                        {result && (
                            <>
                                <div className="response-header">
                                    <span className="response-location">📍 {result.name}{result.state ? `, ${result.state}` : ""}</span>
                                    <span className="response-desc">{result.country}</span>
                                </div>
                                <div className="response-stats">
                                    <div className="stat">
                                        <span className="stat-icon">🧭</span>
                                        <span className="stat-value">{result.lat.toFixed(4)}</span>
                                        <span className="stat-label">Latitude</span>
                                    </div>
                                    <div className="stat-divider" />
                                    <div className="stat">
                                        <span className="stat-icon">🗺️</span>
                                        <span className="stat-value">{result.lon.toFixed(4)}</span>
                                        <span className="stat-label">Longitude</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="error-page">
            <h2>400</h2>
            <p>Server Not Found</p>
        </div>
    );
}