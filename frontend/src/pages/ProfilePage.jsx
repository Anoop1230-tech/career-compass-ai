import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ChangePassword from "../components/ChangePassword";
import { RATINGS } from "../profile/profileForm";
import * as api from "../services/api";

const labelFor = (list, value) => list?.find((o) => o.value === value)?.label || value;

function Row({ term, children }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

function Tags({ items, empty }) {
  if (!items?.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="tag-list">
      {items.map((item) => (
        <li key={item} className="badge">
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function ProfilePage() {
  const { user, logout, markProfileSaved } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api.getProfileOptions(), api.getProfile()])
      .then(([options, profile]) => active && setState({ status: "ready", options, profile }))
      .catch((err) => {
        if (!active) return;
        if (api.isNotFound(err)) setState({ status: "empty" });
        else if (api.isUnauthorized(err)) setState({ status: "unauthorized" });
        else setState({ status: "error", error: api.getErrorMessage(err) });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  if (state.status === "loading") {
    return (
      <div className="page-center" role="status" aria-label="Loading your profile">
        <div className="loader" />
      </div>
    );
  }
  if (state.status === "empty") return <Navigate to="/profile/edit" replace />;
  if (state.status === "unauthorized") return <Navigate to="/login" replace state={{ from: "/profile" }} />;
  if (state.status === "error") {
    return (
      <section className="page-center" role="alert">
        <div className="page-center__box">
          <h1>Could not load your profile</h1>
          <p className="muted">{state.error}</p>
          <button type="button" className="btn btn--primary" onClick={() => {
            setState({ status: "loading" });
            setAttempt((n) => n + 1);
          }}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  const { profile: p, options: o } = state;
  const edu = p.education;
  const exp = p.experience;
  const score = edu.score != null ? `${edu.score} (${labelFor(o.score_types, edu.score_type)})` : null;

  const handleDelete = async () => {
    if (!window.confirm("Delete your profile? Your account stays, but all profile details are removed.")) return;
    setDeleting(true);
    try {
      await api.deleteProfile();
      markProfileSaved(false);
      navigate("/profile/edit", { replace: true });
    } catch (err) {
      setDeleting(false);
      window.alert(api.getErrorMessage(err));
    }
  };

  return (
    <section className="page">
      <div className="container">
        {location.state?.saved && (
          <div className="notice" role="status" style={{ marginBottom: "var(--space-5)" }}>
            Profile saved.
          </div>
        )}
        <div className="page__head">
          <div>
            <h1>{p.full_name}</h1>
            <p className="muted">
              {labelFor(o.stages, p.current_stage)}
              {p.location ? ` · ${p.location}` : ""} · {user?.email}
            </p>
          </div>
          <div className="btn-row">
            <Link to="/dashboard" className="btn btn--primary">
              Dashboard
            </Link>
            <Link to="/profile/edit" className="btn btn--secondary">
              Edit profile
            </Link>
            <button type="button" className="btn btn--secondary" onClick={() => {
              navigate("/", { replace: true }); // leave the protected page first
              logout();
            }}>
              Log out
            </button>
          </div>
        </div>

        <div className="summary">
          <article className="card">
            <h2>Education</h2>
            <dl className="dl">
              <Row term="Degree">{edu.degree}</Row>
              <Row term="Branch">{edu.branch}</Row>
              <Row term="Stream">{edu.stream ? labelFor(o.streams, edu.stream) : null}</Row>
              <Row term="Institution">{edu.institution}</Row>
              <Row term="Year of study">{edu.year_of_study}</Row>
              <Row term="Graduation">{edu.graduation_year}</Row>
              <Row term="Score">{score}</Row>
            </dl>
            {!Object.values(edu).some((v) => v != null) && <p className="muted">No education details yet.</p>}
          </article>

          <article className="card">
            <h2>Skills</h2>
            <Tags
              items={p.skills.map((s) => `${s.name} · ${labelFor(o.skill_levels, s.level)}`)}
              empty="No skills added yet."
            />
            {p.certifications.length > 0 && (
              <>
                <h3 style={{ marginTop: "var(--space-4)", fontSize: "var(--text-base)" }}>Certifications</h3>
                <ul className="plain-list">
                  {p.certifications.map((c, i) => (
                    <li key={i}>
                      {c.name}
                      {c.issuer ? `, ${c.issuer}` : ""}
                      {c.year ? ` (${c.year})` : ""}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </article>

          <article className="card">
            <h2>Experience</h2>
            <dl className="dl">
              <Row term="Current role">{exp.current_role}</Row>
              <Row term="Total experience">{exp.total_years != null ? `${exp.total_years} years` : null}</Row>
              <Row term="Internships">{exp.internships.length || null}</Row>
              <Row term="Jobs">{exp.jobs.length || null}</Row>
            </dl>
            {exp.projects.length > 0 ? (
              <>
                <h3 style={{ marginTop: "var(--space-4)", fontSize: "var(--text-base)" }}>Projects</h3>
                <ul className="plain-list">
                  {exp.projects.map((pr, i) => (
                    <li key={i}>
                      {pr.link ? (
                        <a href={pr.link} target="_blank" rel="noopener noreferrer">
                          {pr.title}
                        </a>
                      ) : (
                        pr.title
                      )}
                      {pr.technologies.length ? <span className="muted"> · {pr.technologies.join(", ")}</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              !exp.current_role && !exp.internships.length && !exp.jobs.length && (
                <p className="muted">No experience or projects added yet.</p>
              )
            )}
          </article>

          <article className="card">
            <h2>Interests and goals</h2>
            <Tags items={p.interests.map((v) => labelFor(o.interests, v))} empty="No interests selected." />
            <div style={{ marginTop: "var(--space-4)" }}>
              <Tags items={p.goals.map((v) => labelFor(o.goals, v))} empty="No goals selected." />
            </div>
          </article>

          <article className="card">
            <h2>Preferences</h2>
            <dl className="dl">
              <Row term="Work mode">{labelFor(o.work_modes, p.preferences.work_mode)}</Row>
              <Row term="Locations">{p.preferences.preferred_locations.join(", ") || null}</Row>
              <Row term="Relocation">{p.preferences.open_to_relocation ? "Open" : "Not open"}</Row>
              {RATINGS.map((r) => (
                <Row key={r.key} term={r.label}>
                  {p.preferences[r.key] != null ? `${p.preferences[r.key]} / 5` : null}
                </Row>
              ))}
            </dl>
          </article>
        </div>

        {p.bio && (
          <article className="card" style={{ marginTop: "var(--space-4)" }}>
            <h2 style={{ fontSize: "var(--text-lg)" }}>About me</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{p.bio}</p>
          </article>
        )}

        <ChangePassword />

        <div style={{ marginTop: "var(--space-6)" }}>
          <button type="button" className="btn btn--danger btn--small" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete profile"}
          </button>
        </div>
      </div>
    </section>
  );
}
