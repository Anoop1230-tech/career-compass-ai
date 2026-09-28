import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { KIND_LABELS, LIKERT, clearProgress, loadProgress, saveProgress, scaleLabel } from "../assessments/assessmentUtils";
import { startRequests } from "../assessments/startRequests";
import * as api from "../services/api";

const KINDS = ["interest", "personality", "aptitude"];

export default function AssessmentTestPage() {
  const { kind } = useParams();
  const navigate = useNavigate();
  const headingRef = useRef(null);

  const [test, setTest] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const restartRef = useRef(false); // one-time "start over" request

  const validKind = KINDS.includes(kind);

  useEffect(() => {
    if (!validKind) return undefined;
    let active = true;
    const restart = restartRef.current;
    restartRef.current = false;
    // One request per (kind, attempt counter): React's development double-mount
    // would otherwise send two start requests at the same moment.
    const key = `${kind}:${attempt}:${restart}`;
    if (!startRequests.has(key)) startRequests.set(key, api.startAssessment(kind, restart));
    startRequests
      .get(key)
      .finally(() => setTimeout(() => startRequests.delete(key), 1000))
      .then((data) => {
        if (!active) return;
        const saved = loadProgress(kind, data.attempt_id);
        const ids = new Set(data.questions.map((q) => q.question_id));
        const kept = Object.fromEntries(Object.entries(saved.answers || {}).filter(([id]) => ids.has(id)));
        setTest(data);
        setAnswers(kept);
        setIndex(Math.min(Math.max(0, Number(saved.index) || 0), data.questions.length - 1));
        setLoadError("");
      })
      .catch((err) => active && setLoadError(api.getErrorMessage(err)));
    return () => {
      active = false;
    };
  }, [kind, validKind, attempt]);

  // Save progress on every change
  useEffect(() => {
    if (test) saveProgress(kind, test.attempt_id, { answers, index });
  }, [kind, test, answers, index]);

  // Move focus to the question when it changes (keyboard and screen-reader users)
  useEffect(() => {
    headingRef.current?.focus();
  }, [index, test]);

  if (!validKind) {
    return (
      <section className="page-center">
        <div className="page-center__box">
          <h1>Test not found</h1>
          <Link to="/assessments" className="btn btn--primary">See all tests</Link>
        </div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="page-center" role="alert">
        <div className="page-center__box">
          <h1>Could not start the test</h1>
          <p className="muted">{loadError}</p>
          <button type="button" className="btn btn--primary" onClick={() => {
            setLoadError("");
            setAttempt((n) => n + 1);
          }}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (!test) {
    return (
      <div className="page-center" role="status" aria-label="Loading test">
        <div className="loader" />
      </div>
    );
  }

  const questions = test.questions;
  const question = questions[index];
  const total = questions.length;
  const answeredCount = questions.filter((q) => answers[q.question_id] !== undefined).length;
  const isAptitude = test.scale === "choice";
  const current = answers[question.question_id];
  const isLast = index === total - 1;
  // Likert tests need every answer; aptitude questions may be skipped
  const unanswered = questions.filter((q) => answers[q.question_id] === undefined);
  const canSubmit = isAptitude || unanswered.length === 0;

  const choose = (value) => {
    setAnswers((prev) => ({ ...prev, [question.question_id]: value }));
    setSubmitError("");
    // Likert: move on automatically for a faster flow
    if (!isAptitude && !isLast) setTimeout(() => setIndex((i) => Math.min(i + 1, total - 1)), 150);
  };

  const submit = async () => {
    if (submitting) return;
    if (!canSubmit) {
      setSubmitError(`Please answer all questions. ${unanswered.length} left.`);
      setIndex(questions.indexOf(unanswered[0]));
      return;
    }
    if (isAptitude && unanswered.length > 0 &&
        !window.confirm(`${unanswered.length} question(s) are unanswered and will count as wrong. Submit anyway?`)) {
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    const payload = isAptitude
      ? Object.fromEntries(questions.map((q) => [q.question_id, answers[q.question_id] ?? null]))
      : answers;
    try {
      await api.submitAssessment(kind, test.attempt_id, payload);
      clearProgress(kind, test.attempt_id);
      navigate(`/assessments/${kind}/result`, { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409 || status === 410 || status === 404) {
        // Session finished or expired elsewhere: start a clean attempt
        clearProgress(kind, test.attempt_id);
      }
      setSubmitError(api.getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <section className="page">
      <div className="container" style={{ maxWidth: 760 }}>
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <Link to="/assessments">Assessments</Link> <span aria-hidden="true">/</span> <span>{KIND_LABELS[kind]}</span>
        </nav>

        <div className="progress" aria-hidden="true">
          <div className="progress__bar" style={{ width: `${(answeredCount / total) * 100}%` }} />
        </div>
        <p className="small muted" aria-live="polite">
          Question {index + 1} of {total} · {answeredCount} answered
        </p>

        <div className="card question-card">
          {isAptitude && <span className="badge">{scaleLabel(question.category)}</span>}
          <h1 ref={headingRef} tabIndex={-1} className="question-card__text">
            {question.text}
          </h1>

          <fieldset className="field">
            <legend className="visually-hidden">Your answer</legend>
            <div className={isAptitude ? "choices" : "likert"}>
              {isAptitude
                ? question.options.map((o) => (
                    <label key={o.key} className="choice">
                      <input type="radio" name={question.question_id} checked={current === o.key}
                        onChange={() => choose(o.key)} />
                      <span><strong>{o.key.toUpperCase()}.</strong> {o.text}</span>
                    </label>
                  ))
                : LIKERT[test.scale].map((label, i) => (
                    <label key={label} className="choice">
                      <input type="radio" name={question.question_id} checked={current === i + 1}
                        onChange={() => choose(i + 1)} />
                      <span>{label}</span>
                    </label>
                  ))}
            </div>
          </fieldset>
          {isAptitude && current !== undefined && (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => {
              setAnswers((prev) => {
                const next = { ...prev };
                delete next[question.question_id];
                return next;
              });
            }}>
              Clear answer
            </button>
          )}
        </div>

        {submitError && (
          <div className="notice notice--danger" role="alert" style={{ marginTop: "var(--space-4)" }}>
            {submitError}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn--secondary" disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}>
            Back
          </button>
          <div className="btn-row">
            {!isLast && (
              <button type="button" className="btn btn--secondary" onClick={() => setIndex((i) => i + 1)}>
                {isAptitude && current === undefined ? "Skip" : "Next"}
              </button>
            )}
            {(isLast || answeredCount === total) && (
              <button type="button" className="btn btn--primary" onClick={submit} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit"}
              </button>
            )}
          </div>
        </div>

        <p className="small muted" style={{ marginTop: "var(--space-5)" }}>
          Your answers are saved on this device as you go, so you can come back later.{" "}
          <button type="button" className="link-button" onClick={() => {
            if (!window.confirm("Start this test again from the beginning?")) return;
            clearProgress(kind, test.attempt_id);
            setTest(null);
            restartRef.current = true;
            setAttempt((n) => n + 1);
          }}>
            Start over
          </button>
        </p>
      </div>
    </section>
  );
}
