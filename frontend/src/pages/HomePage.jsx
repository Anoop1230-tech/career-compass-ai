import { useEffect, useState } from "react";
import { getHealth } from "../services/api";

export default function HomePage() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Runs once when the page loads: calls the backend health endpoint
  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="container">
      <h1>Career Compass AI</h1>
      <p>Personalized Career Guidance &amp; Roadmap</p>

      {/* aria-live lets screen readers announce the status once it loads */}
      <section aria-live="polite" role="status" className="status-card">
        <h2>System Status</h2>
        {loading && <p>Checking backend…</p>}
        {error && <p className="error">Backend unreachable: {error}</p>}
        {health && (
          <ul>
            <li>Frontend: running</li>
            <li>Backend: {health.status}</li>
            <li>Database: {health.database}</li>
          </ul>
        )}
      </section>
    </main>
  );
}
