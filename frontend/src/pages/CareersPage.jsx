import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as api from "../services/api";

const PAGE_SIZE = 24;

/** Waits until the user stops typing before searching. */
function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function CareersPage() {
  // Filters live in the URL: shareable links, and Back/Forward work
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const domain = params.get("domain") || "";
  const stage = params.get("stage") || "";
  const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);

  const [text, setText] = useState(q);
  const debouncedText = useDebounced(text);
  const [stages, setStages] = useState([]);
  const [state, setState] = useState({ status: "loading", data: null, error: "" });
  const [attempt, setAttempt] = useState(0);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (!("page" in changes)) next.delete("page"); // new filter -> back to page 1
    setParams(next, { replace: true });
  };

  // Typing updates the URL after a short pause
  useEffect(() => {
    if (debouncedText.trim() !== q) update({ q: debouncedText.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedText]);

  useEffect(() => {
    api.getStages().then(setStages).catch(() => setStages([])); // filter is optional; ignore failures
  }, []);

  useEffect(() => {
    const controller = new AbortController(); // cancel outdated searches
    api
      .getCareers({ q, domain, stage, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }, controller.signal)
      .then((data) => setState({ status: "ready", data, error: "" }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", data: null, error: api.getErrorMessage(err) });
      });
    return () => controller.abort();
  }, [q, domain, stage, page, attempt]);

  const data = state.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const hasFilters = Boolean(q || domain || stage);

  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>Careers</h1>
            <p className="muted">Browse careers, the skills they need, and how people get there.</p>
          </div>
        </div>

        <form className="filters" role="search" onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label htmlFor="career-search" className="field__label">Search</label>
            <input
              id="career-search"
              type="search"
              className="input"
              placeholder="e.g. data, security, teacher"
              value={text}
              maxLength={60}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="career-domain" className="field__label">Field</label>
            <select id="career-domain" className="input" value={domain} onChange={(e) => update({ domain: e.target.value })}>
              <option value="">All fields</option>
              {(data?.domains || (domain ? [domain] : [])).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="career-stage" className="field__label">Common after</label>
            <select id="career-stage" className="input" value={stage} onChange={(e) => update({ stage: e.target.value })}>
              <option value="">Any education</option>
              {stages.map((s) => (
                <option key={s.stage_id} value={s.stage_id}>{s.name}</option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <button type="button" className="btn btn--ghost filters__clear" onClick={() => {
              setText("");
              setParams(new URLSearchParams(), { replace: true });
            }}>
              Clear filters
            </button>
          )}
        </form>

        <p className="muted" role="status" aria-live="polite" style={{ margin: "var(--space-4) 0" }}>
          {state.status === "ready" && `${data.total} ${data.total === 1 ? "career" : "careers"} found`}
        </p>

        {state.status === "loading" && (
          <div className="page-center" style={{ minHeight: 200 }} role="status" aria-label="Loading careers">
            <div className="loader" />
          </div>
        )}

        {state.status === "error" && (
          <div className="notice notice--danger" role="alert">
            <p>{state.error}</p>
            <button type="button" className="btn btn--secondary btn--small" onClick={() => {
              setState({ status: "loading", data: null, error: "" });
              setAttempt((n) => n + 1);
            }}>
              Try again
            </button>
          </div>
        )}

        {state.status === "ready" && data.total === 0 && (
          <div className="notice">
            No careers match these filters. Try a shorter search word or clear the filters.
          </div>
        )}

        {state.status === "ready" && data.items.length > 0 && (
          <ul className="grid" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {data.items.map((c) => (
              <li key={c.career_id}>
                <Link to={`/careers/${c.career_id}`} className="card card--link career-card">
                  <span className="badge">{c.sub_domain || c.domain}</span>
                  <h2 className="career-card__title">{c.name}</h2>
                  <p className="muted">{c.description}</p>
                  <span className="card__arrow">View details →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {state.status === "ready" && pages > 1 && (
          <nav className="pagination" aria-label="Pages">
            <button type="button" className="btn btn--secondary btn--small" disabled={page <= 1}
              onClick={() => update({ page: String(page - 1) })}>
              Previous
            </button>
            <span className="muted">Page {page} of {pages}</span>
            <button type="button" className="btn btn--secondary btn--small" disabled={page >= pages}
              onClick={() => update({ page: String(page + 1) })}>
              Next
            </button>
          </nav>
        )}
      </div>
    </section>
  );
}
