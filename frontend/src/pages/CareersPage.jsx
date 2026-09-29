import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as api from "../services/api";

// All careers fit on one page (the catalog is small), grouped by field
const LIMIT = 100;

// Field order and a one-line explanation for each section; unknown fields are added at the end
const CATEGORIES = [
  { name: "Technology", text: "Software, data, AI, cloud, security and electronics." },
  { name: "Business", text: "Product, analysis, management and starting your own business." },
  { name: "Finance", text: "Accounts, audit and financial analysis." },
  { name: "Government", text: "Civil services, public sector and banking jobs through exams." },
  { name: "Education", text: "Teaching in schools and colleges." },
  { name: "Creative Arts", text: "Music, dance, design, writing, acting, comedy, film and media. No degree needed." },
  { name: "Vocational", text: "Hands-on skill careers: cooking, fitness and beauty. No degree needed." },
];

const slug = (name) => `field-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

/** Groups careers by field in CATEGORIES order; inside a field, by sub-area and then name. */
function groupByField(items) {
  const byField = new Map();
  for (const c of items) {
    if (!byField.has(c.domain)) byField.set(c.domain, []);
    byField.get(c.domain).push(c);
  }
  const known = CATEGORIES.filter((cat) => byField.has(cat.name));
  const extra = [...byField.keys()].filter((d) => !CATEGORIES.some((cat) => cat.name === d)).sort()
    .map((name) => ({ name, text: "" }));
  return [...known, ...extra].map((cat) => ({
    ...cat,
    careers: byField.get(cat.name).sort((a, b) =>
      (a.sub_domain || "").localeCompare(b.sub_domain || "") || a.name.localeCompare(b.name)),
  }));
}

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

  const [text, setText] = useState(q);
  const debouncedText = useDebounced(text);
  const [stages, setStages] = useState([]);
  const [state, setState] = useState({ status: "loading", data: null, error: "" });
  const [attempt, setAttempt] = useState(0);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    next.delete("page"); // old paged links still work: everything is on one page now
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
      .getCareers({ q, domain, stage, limit: LIMIT, offset: 0 }, controller.signal)
      .then((data) => setState({ status: "ready", data, error: "" }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", data: null, error: api.getErrorMessage(err) });
      });
    return () => controller.abort();
  }, [q, domain, stage, attempt]);

  const data = state.data;
  const fields = data ? groupByField(data.items) : [];
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

        {state.status === "ready" && fields.length > 1 && (
          <nav className="field-jump" aria-label="Jump to a category">
            {fields.map((f) => (
              <a key={f.name} href={`#${slug(f.name)}`} className="field-jump__link">
                {f.name} <span className="field-jump__count">{f.careers.length}</span>
              </a>
            ))}
          </nav>
        )}

        {state.status === "ready" && fields.map((f) => (
          <section key={f.name} className="career-field" aria-labelledby={slug(f.name)}>
            <div className="career-field__head">
              <h2 id={slug(f.name)}>{f.name} <span className="muted career-field__count">{f.careers.length}</span></h2>
              {f.text && <p className="muted">{f.text}</p>}
            </div>
            <ul className="grid" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {f.careers.map((c) => (
                <li key={c.career_id}>
                  <Link to={`/careers/${c.career_id}`} className="card card--link career-card">
                    <span className="badge">{c.sub_domain || c.domain}</span>
                    <h3 className="career-card__title">{c.name}</h3>
                    <p className="muted">{c.description}</p>
                    <span className="card__arrow">View details →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
