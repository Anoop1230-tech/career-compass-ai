import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorNotice, Loading } from "../components/Status";
import useRequest from "../hooks/useRequest";
import { useI18n } from "../i18n";
import * as api from "../services/api";

/** Renders mentor text: paragraphs and "- " bullet lists, as plain text (no HTML injection). */
function MessageText({ text }) {
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const lines = block.split("\n");
    const bullets = lines.filter((l) => l.startsWith("- "));
    const intro = lines.filter((l) => !l.startsWith("- "));
    return (
      <div key={i} className="chat-block">
        {intro.map((l, j) => <p key={j}>{l}</p>)}
        {bullets.length > 0 && <ul>{bullets.map((b, j) => <li key={j}>{b.slice(2)}</li>)}</ul>}
      </div>
    );
  });
}

function Action({ action }) {
  const { t } = useI18n();
  if (action.link.startsWith("https://")) {
    return (
      <a className="btn btn--secondary btn--small" href={action.link} target="_blank" rel="noopener noreferrer">
        {action.label}<span className="visually-hidden"> {t("common.newTab")}</span>
      </a>
    );
  }
  return <Link className="btn btn--secondary btn--small" to={action.link}>{action.label}</Link>;
}

export default function MentorPage() {
  const { t } = useI18n();
  const history = useRequest(() => api.getMentorHistory(), []);
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const pendingCount = useRef(0);

  const list = messages ?? history.data?.messages ?? [];
  const lastMentor = [...list].reverse().find((m) => m.role === "mentor");
  const suggestions = lastMentor?.suggestions?.length ? lastMentor.suggestions : history.data?.suggestions ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [list.length, sending]);

  const send = async (text) => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    pendingCount.current += 1;
    const pending = { id: `pending-${pendingCount.current}`, role: "user", content: message };
    setMessages([...list, pending]);
    setDraft("");
    try {
      const res = await api.sendMentorMessage(message);
      setMessages((current) => [...current.filter((m) => m.id !== pending.id), res.message, res.reply]);
    } catch (err) {
      setMessages((current) => current.filter((m) => m.id !== pending.id));
      setDraft(message); // nothing is lost: the question goes back into the box
      setError(api.getErrorMessage(err));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const clear = async () => {
    if (!window.confirm(t("mentor.confirmClear"))) return;
    try {
      await api.clearMentorHistory();
      setMessages([]);
    } catch (err) {
      setError(api.getErrorMessage(err));
    }
  };

  return (
    <section className="page">
      <div className="container chat-page">
        <div className="page__head">
          <div>
            <h1>{t("mentor.title")}</h1>
            <p className="muted">{t("mentor.lead")}</p>
          </div>
          {list.length > 0 && (
            <button type="button" className="btn btn--ghost btn--small" onClick={clear}>{t("mentor.clear")}</button>
          )}
        </div>

        {history.status === "loading" && <Loading label={t("mentor.loading")} />}
        {history.status === "error" && <ErrorNotice message={history.error} onRetry={history.reload} />}

        {history.status === "ready" && (
          <div className="chat card">
            <ol className="chat__log" aria-live="polite" aria-label={t("mentor.conversation")}>
              {list.length === 0 && (
                <li className="chat__empty muted">
                  {t("mentor.empty")}
                </li>
              )}
              {list.map((m) => (
                <li key={m.id} className={`chat-msg chat-msg--${m.role}`}>
                  <span className="visually-hidden">{m.role === "user" ? t("mentor.youSaid") : t("mentor.mentorSaid")}</span>
                  <div className="chat-msg__bubble">
                    {m.role === "mentor" ? <MessageText text={m.content} /> : <p>{m.content}</p>}
                    {m.actions?.length > 0 && (
                      <div className="btn-row chat-msg__actions">{m.actions.map((a) => <Action key={a.link} action={a} />)}</div>
                    )}
                  </div>
                </li>
              ))}
              {sending && (
                <li className="chat-msg chat-msg--mentor" role="status">
                  <div className="chat-msg__bubble muted">{t("mentor.thinking")}</div>
                </li>
              )}
              <li ref={endRef} aria-hidden="true" />
            </ol>

            {suggestions.length > 0 && (
              <div className="chat__suggestions" role="group" aria-label={t("mentor.suggested")}>
                {suggestions.map((s) => (
                  <button key={s} type="button" className="tab" disabled={sending} onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            )}
            {error && <p className="text-danger small" role="alert" style={{ margin: "0 var(--space-4)" }}>{error}</p>}

            <form className="chat__form" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
              <label htmlFor="mentor-input" className="visually-hidden">{t("mentor.yourQuestion")}</label>
              <input id="mentor-input" ref={inputRef} className="input" value={draft} maxLength={500}
                placeholder={t("mentor.placeholder")} autoComplete="off" onChange={(e) => setDraft(e.target.value)} />
              <button type="submit" className="btn btn--primary" disabled={sending || !draft.trim()}>{t("mentor.send")}</button>
            </form>
          </div>
        )}
        <p className="small muted" style={{ marginTop: "var(--space-4)" }}>
          {t("mentor.disclaimer")}
          {history.data?.llm_enabled && ` ${t("mentor.llm")}`}
        </p>
      </div>
    </section>
  );
}
