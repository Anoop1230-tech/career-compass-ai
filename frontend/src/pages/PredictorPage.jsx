import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading } from "../components/Status";
import useRequest from "../hooks/useRequest";
import { useI18n } from "../i18n";
import * as api from "../services/api";

const PROGRAMS = ["", "EDU_BTECH_CSE", "EDU_BTECH_ECE", "EDU_BTECH_MECH"];
const SEATS = ["OPEN", "EWS", "OBC-NCL", "SC", "ST"];
const BAND_TONE = { likely: "ok", borderline: "partial", unlikely: "missing" };

/** Form values live in the URL so results can be shared and survive reloads. */
function Form({ initial, onSubmit }) {
  const { t } = useI18n();
  const [v, setV] = useState(initial);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const rank = Number(v.rank);
  const valid = Number.isInteger(rank) && rank >= 1 && rank <= 2000000;
  return (
    <form className="filters" onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit(v); }}>
      <div className="field">
        <label className="field__label" htmlFor="pred-exam">{t("pred.exam")}</label>
        <select id="pred-exam" className="input" value={v.exam} onChange={set("exam")}>
          <option value="EXM_JEE_MAIN">{t("pred.exam.main")}</option>
          <option value="EXM_JEE_ADVANCED">{t("pred.exam.advanced")}</option>
        </select>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="pred-seat">{t("pred.seat")}</label>
        <select id="pred-seat" className="input" value={v.seat_type} onChange={set("seat_type")}>
          {SEATS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="pred-rank">{v.seat_type === "OPEN" ? t("pred.rank.crl") : t("pred.rank.category")}</label>
        <input id="pred-rank" className="input" type="number" inputMode="numeric" min="1" max="2000000" required
          value={v.rank} onChange={set("rank")} aria-describedby="pred-rank-hint" />
        <p id="pred-rank-hint" className="small muted">{t("pred.rank.hint")}</p>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="pred-program">{t("pred.program")}</label>
        <select id="pred-program" className="input" value={v.program} onChange={set("program")}>
          {PROGRAMS.map((p) => <option key={p} value={p}>{p ? t(`pred.program.${p}`) : t("pred.program.all")}</option>)}
        </select>
      </div>
      <label className="radio-inline small">
        <input type="checkbox" checked={v.female} onChange={set("female")} /> {t("pred.female")}
      </label>
      <label className="radio-inline small">
        <input type="checkbox" checked={v.unlikely} onChange={set("unlikely")} /> {t("pred.showUnlikely")}
      </label>
      <button type="submit" className="btn btn--primary" disabled={!valid}>{t("pred.submit")}</button>
    </form>
  );
}

export default function PredictorPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const q = {
    exam: params.get("exam") === "EXM_JEE_ADVANCED" ? "EXM_JEE_ADVANCED" : "EXM_JEE_MAIN",
    rank: params.get("rank") || "",
    seat_type: SEATS.includes(params.get("seat")) ? params.get("seat") : "OPEN",
    program: PROGRAMS.includes(params.get("program")) ? params.get("program") : "",
    female: params.get("female") === "1",
    unlikely: params.get("unlikely") === "1",
  };
  const key = params.toString();
  const ready = Number(q.rank) >= 1;
  const result = useRequest((signal) => (ready ? api.predictColleges({
    exam: q.exam, rank: Number(q.rank), seat_type: q.seat_type, female: q.female,
    ...(q.program ? { program: q.program } : {}), include_unlikely: q.unlikely,
  }, signal) : Promise.resolve(null)), [key]);
  const d = result.data;

  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>{t("pred.title")}</h1>
            <p className="muted">{t("pred.lead")}</p>
          </div>
        </div>
        <Form key={key} initial={q} onSubmit={(v) => setParams({
          exam: v.exam, rank: String(v.rank), seat: v.seat_type, ...(v.program ? { program: v.program } : {}),
          ...(v.female ? { female: "1" } : {}), ...(v.unlikely ? { unlikely: "1" } : {}),
        })} />

        {result.status === "loading" && ready && <Loading label={t("pred.loading")} />}
        {result.status === "error" && <ErrorNotice message={result.error} onRetry={result.reload} />}

        {d && (
          <>
            <p className="small muted" role="status" style={{ margin: "var(--space-4) 0" }}>
              {t("pred.counts", { likely: d.counts.likely, borderline: d.counts.borderline })}
              {q.unlikely && ` · ${t("pred.countUnlikely", { n: d.counts.unlikely })}`}
              {d.total > d.items.length && ` · ${t("pred.shown", { n: d.items.length })}`}
            </p>
            {d.items.length === 0 ? <p className="notice">{t("pred.none")}</p> : (
              <div className="table-wrap">
                <table className="table table--stack">
                  <caption className="visually-hidden">{t("pred.caption")}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t("pred.col.institute")}</th>
                      <th scope="col">{t("pred.col.program")}</th>
                      <th scope="col">{t("pred.col.closing")}</th>
                      <th scope="col">{t("pred.col.chance")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((i) => (
                      <tr key={`${i.institute_name}-${i.stage_id}`}>
                        <th scope="row">{i.institute_name}</th>
                        <td data-label={t("pred.col.program")}>{t(`pred.program.${i.stage_id}`)}
                          {i.gender === "female" && <span className="muted small"> · {t("pred.femalePool")}</span>}</td>
                        <td data-label={t("pred.col.closing")}>{i.closing_rank.toLocaleString("en-IN")}</td>
                        <td data-label={t("pred.col.chance")}><span className={`badge badge--${BAND_TONE[i.band]}`}>{t(`pred.band.${i.band}`)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {d.source && (
              <p className="notice small" style={{ marginTop: "var(--space-5)" }}>
                {t("pred.source", { year: d.source.year, round: d.source.round })}{" "}
                <a href={d.source.url} target="_blank" rel="noopener noreferrer">
                  JoSAA<span className="visually-hidden"> {t("common.officialNewTab")}</span>
                </a>. {t("pred.disclaimer")}
              </p>
            )}
          </>
        )}
        {!ready && <p className="notice small" style={{ marginTop: "var(--space-5)" }}>{t("pred.disclaimer")}</p>}
      </div>
    </section>
  );
}
