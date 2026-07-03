import { useEffect, useState } from "react"
import axios from "axios"
import "./Weather.css"

type WeatherResult = {
    name: string;
    description: string;
    temp: number;
    feels_like: number;
    humidity: number;
    wind: number;
}

export function Weather() {
    const [Lat, setLat] = useState("");
    const [Lon, setLon] = useState("");
    const [serverOnline, setServerOnline] = useState<boolean | null>(null);
    const [result, setResult] = useState<WeatherResult | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const send = async () => {
        setLoading(true);
        setError("");
        setResult(null);
        try {
            const res = await axios.get(`/api-service/api/api/weather/?lat=${Lat}&lon=${Lon}`)
            const { name, main, weather, wind } = res.data;
            setResult({
                name,
                description: weather[0].description,
                temp: main.temp,
                feels_like: main.feels_like,
                humidity: main.humidity,
                wind: wind.speed,
            });
        } catch (e) {
            console.log(e)
            setError("Request failed. Check your coordinates.")
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
                    <h1>Weather API</h1>
                    <p>Enter the coordinates of the area you want to check the weather for.</p>

                    <form>
                        <div className="field">
                            <label>Latitude</label>
                            <input
                                type="number"
                                value={Lat}
                                placeholder="e.g. 13.0836"
                                onChange={(e) => setLat(e.target.value)}
                            />
                        </div>
                        <div className="field">
                            <label>Longitude</label>
                            <input
                                type="number"
                                value={Lon}
                                placeholder="e.g. 80.2705"
                                onChange={(e) => setLon(e.target.value)}
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
                                    <span className="response-location">📍 {result.name}</span>
                                    <span className="response-desc">{result.description}</span>
                                </div>
                                <div className="response-stats">
                                    <div className="stat">
                                        <span className="stat-icon">🌡️</span>
                                        <span className="stat-value">{result.temp}°C</span>
                                        <span className="stat-label">Temp</span>
                                    </div>
                                    <div className="stat-divider" />
                                    <div className="stat">
                                        <span className="stat-icon">🤔</span>
                                        <span className="stat-value">{result.feels_like}°C</span>
                                        <span className="stat-label">Feels Like</span>
                                    </div>
                                    <div className="stat-divider" />
                                    <div className="stat">
                                        <span className="stat-icon">💧</span>
                                        <span className="stat-value">{result.humidity}%</span>
                                        <span className="stat-label">Humidity</span>
                                    </div>
                                    <div className="stat-divider" />
                                    <div className="stat">
                                        <span className="stat-icon">💨</span>
                                        <span className="stat-value">{result.wind} m/s</span>
                                        <span className="stat-label">Wind</span>
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