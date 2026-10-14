import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading, OfficialLink } from "../components/Status";
import { useAuth } from "../context/AuthContext";
import { branchName, foldFamilies, groupStages } from "../degreeFamilies";
import useRequest from "../hooks/useRequest";
import { useI18n } from "../i18n";
import * as api from "../services/api";

function duration(t, years) {
  if (years < 1) return t("dream.months", { n: Math.round(years * 12) });
  return years === 1 ? t("next.oneYear") : t("next.years", { n: years });
}

function edgeText(t, edge) {
  if (!edge) return null;
  const parts = [];
  if (edge.years) parts.push(duration(t, edge.years));
  if (edge.experience) parts.push(t("tree.afterYears", { n: edge.experience }));
  if (edge.months) parts.push(t("dream.months", { n: edge.months }));
  if (edge.exams?.length) parts.push(t("tree.via", { list: edge.exams.join(" / ") }));
  return parts.join(" · ");
}

const COURSE_PREFIX = "Professional course – ";

/** Renders a list of tree nodes: professional courses fold under one "Professional courses" row,
 * and the branches of a degree (B.Tech, diploma, M.Tech) fold under one row for that degree. */
function TreeList({ nodes, depth, label, keyPrefix }) {
  const courses = nodes.filter((n) => n.type === "stage" && n.level === "course");
  const rest = nodes.filter((n) => !courses.includes(n));
  const folded = foldFamilies(rest, (n) => (n.type === "stage" ? n.id : null));
  const firstCareer = folded.findIndex((e) => e.item && e.item.type !== "stage");
  const at = firstCareer === -1 ? folded.length : firstCareer;
  const item = (e) => (e.family
    ? <BranchGroup key={`${keyPrefix}-family-${e.family.key}`} family={e.family} nodes={e.items} depth={depth} />
    : <TreeNode key={`${keyPrefix}-${e.item.type}-${e.item.id}`} node={e.item} depth={depth} />);
  return (
    <ul className="tree" aria-label={label}>
      {folded.slice(0, at).map(item)}
      {courses.length > 0 && <CourseGroup courses={courses} depth={depth} />}
      {folded.slice(at).map(item)}
    </ul>
  );
}

function BranchGroup({ family, nodes, depth }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const name = t(`family.${family.key}`);
  const extra = edgeText(t, nodes[0].edge);
  const short = nodes.map((n) => ({ ...n, title: branchName(n.title), edge: { ...n.edge, label: t("tree.branch") } }));
  return (
    <li className="tree-node tree-node--group">
      <div className="tree-node__row">
        <button type="button" className="tree-toggle" aria-expanded={open}
          aria-label={t(open ? "tree.collapse" : "tree.expand", { name })} onClick={() => setOpen(!open)}>
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
        <div className="tree-node__body">
          <span className="badge tree-badge tree-badge--stage">{nodes[0].edge?.label || t("tree.type.stage")}</span>{" "}
          <span className="tree-node__title">{name}</span>
          <span className="tree-node__meta muted small">
            {t("tree.branchesMeta", { n: nodes.length })}{extra ? ` · ${extra}` : ""}
          </span>
        </div>
      </div>
      {open && (
        <div className="tree-node__children">
          <ul className="tree" aria-label={name}>
            {short.map((n) => <TreeNode key={`branch-${n.id}`} node={n} depth={depth + 1} />)}
          </ul>
        </div>
      )}
    </li>
  );
}

function CourseGroup({ courses, depth }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const short = courses.map((c) => ({ ...c, title: c.title.replace(COURSE_PREFIX, "") }));
  return (
    <li className="tree-node tree-node--group">
      <div className="tree-node__row">
        <button type="button" className="tree-toggle" aria-expanded={open}
          aria-label={t(open ? "tree.collapse" : "tree.expand", { name: t("next.group.course") })} onClick={() => setOpen(!open)}>
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
        <div className="tree-node__body">
          <span className="badge tree-badge tree-badge--group">{t("tree.courses")}</span>{" "}
          <span className="tree-node__title">{t("next.group.course")}</span>
          <span className="tree-node__meta muted small">
            {t("tree.coursesMeta", { n: courses.length })}
          </span>
        </div>
      </div>
      {open && (
        <div className="tree-node__children">
          <ul className="tree" aria-label={t("next.group.course")}>
            {short.map((c) => <TreeNode key={`course-${c.id}`} node={c} depth={depth + 1} />)}
          </ul>
        </div>
      )}
    </li>
  );
}

function TreeNode({ node, depth }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ status: "idle", children: [] });

  const toggle = async () => {
    if (open) return setOpen(false);
    setOpen(true);
    if (state.status === "ready") return;
    setState({ status: "loading", children: [] });
    try {
      const data = await api.expandExplore(node.type, node.id);
      setState({ status: "ready", children: data.children });
    } catch (err) {
      setState({ status: "error", error: api.getErrorMessage(err), children: [] });
    }
  };

  const extra = edgeText(t, node.edge);
  const title = node.type === "career" ? <Link to={`/careers/${node.id}`}>{node.title}</Link>
    : node.type === "exam" ? <OfficialLink href={node.url}>{node.title}</OfficialLink> : node.title;

  return (
    <li className={`tree-node tree-node--${node.type}`}>
      <div className="tree-node__row">
        {node.has_children ? (
          <button type="button" className="tree-toggle" aria-expanded={open}
            aria-label={t(open ? "tree.collapse" : "tree.expand", { name: node.title })} onClick={toggle}>
            <span aria-hidden="true">{open ? "−" : "+"}</span>
          </button>
        ) : <span className="tree-toggle tree-toggle--leaf" aria-hidden="true" />}
        <div className="tree-node__body">
          <span className={`badge tree-badge tree-badge--${node.type}`}>{node.edge?.label || t(`tree.type.${node.type}`)}</span>{" "}
          <span className="tree-node__title">{title}</span>
          {extra && <span className="tree-node__meta muted small">{extra}</span>}
        </div>
      </div>
      {open && (
        <div className="tree-node__children">
          {state.status === "loading" && <p className="muted small" role="status">{t("tree.loadingShort")}</p>}
          {state.status === "error" && <p className="text-danger small" role="alert">{state.error}</p>}
          {state.status === "ready" && state.children.length === 0 && <p className="muted small">{t("tree.nothing")}</p>}
          {state.children.length > 0 && (
            <TreeList nodes={state.children} depth={depth + 1} label={t("tree.optionsAfter", { name: node.title })} keyPrefix={node.id} />
          )}
        </div>
      )}
    </li>
  );
}

export default function ExplorePage() {
  const { status: authStatus } = useAuth();
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const stage = params.get("stage") || undefined;
  const stages = useRequest(() => api.getStages(), []);
  const root = useRequest(
    (signal) => (authStatus === "loading" ? new Promise(() => {}) : api.getExploreRoot(stage, signal)),
    [stage, authStatus],
  );

  return (
    <section className="page">
      <div className="container">
        <div className="page__head">
          <div>
            <h1>{t("tree.title")}</h1>
            <p className="muted">{t("tree.lead")}</p>
          </div>
        </div>
        {stages.status === "ready" && root.data && (
          <div className="toolbar">
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field__label" htmlFor="explore-stage">{t("tree.startFrom")}</label>
              <select id="explore-stage" className="input" value={root.data.root.id}
                onChange={(e) => setParams({ stage: e.target.value })}>
                {groupStages(stages.data, t).map(([label, items]) => (
                  <optgroup key={label} label={label}>
                    {items.map((s) => <option key={s.stage_id} value={s.stage_id}>{s.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              {root.data.source === "profile" ? t("tree.fromProfile") : t("tree.loginTip")}
            </p>
          </div>
        )}

        {root.status === "loading" && <Loading label={t("tree.loading")} />}
        {root.status === "error" && <ErrorNotice message={root.error} onRetry={root.reload} />}
        {root.status === "ready" && (
          <div className="card tree-card">
            <h2 className="tree-root">{root.data.root.title}</h2>
            {root.data.root.subtitle && <p className="muted small">{root.data.root.subtitle}</p>}
            <TreeList nodes={root.data.root.children} depth={1} label={t("tree.optionsAfter", { name: root.data.root.title })}
              keyPrefix={root.data.root.id} />
          </div>
        )}
      </div>
    </section>
  );
}
