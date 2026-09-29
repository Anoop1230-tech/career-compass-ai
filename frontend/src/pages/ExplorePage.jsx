import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading, OfficialLink } from "../components/Status";
import { useAuth } from "../context/AuthContext";
import useRequest from "../hooks/useRequest";
import * as api from "../services/api";

const TYPE_LABEL = { stage: "Study", career: "Career", exam: "Exam" };

function duration(years) {
  if (years < 1) return `${Math.round(years * 12)} months`;
  return years === 1 ? "1 year" : `${years} years`;
}

function edgeText(edge) {
  if (!edge) return null;
  const parts = [];
  if (edge.years) parts.push(duration(edge.years));
  if (edge.experience) parts.push(`after ${edge.experience} years`);
  if (edge.months) parts.push(`${edge.months} months`);
  if (edge.exams?.length) parts.push(`via ${edge.exams.join(" / ")}`);
  return parts.join(" · ");
}

const COURSE_PREFIX = "Professional course – ";

/** Renders a list of tree nodes, with all professional courses folded under one "Professional courses" row. */
function TreeList({ nodes, depth, label, keyPrefix }) {
  const courses = nodes.filter((n) => n.type === "stage" && n.level === "course");
  const rest = nodes.filter((n) => !courses.includes(n));
  const firstCareer = rest.findIndex((n) => n.type !== "stage");
  const at = firstCareer === -1 ? rest.length : firstCareer;
  const item = (n) => <TreeNode key={`${keyPrefix}-${n.type}-${n.id}`} node={n} depth={depth} />;
  return (
    <ul className="tree" aria-label={label}>
      {rest.slice(0, at).map(item)}
      {courses.length > 0 && <CourseGroup courses={courses} depth={depth} />}
      {rest.slice(at).map(item)}
    </ul>
  );
}

function CourseGroup({ courses, depth }) {
  const [open, setOpen] = useState(false);
  const short = courses.map((c) => ({ ...c, title: c.title.replace(COURSE_PREFIX, "") }));
  return (
    <li className="tree-node tree-node--group">
      <div className="tree-node__row">
        <button type="button" className="tree-toggle" aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} Professional courses`} onClick={() => setOpen(!open)}>
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
        <div className="tree-node__body">
          <span className="badge tree-badge tree-badge--group">Courses</span>{" "}
          <span className="tree-node__title">Professional courses</span>
          <span className="tree-node__meta muted small">
            {courses.length} courses · music, dance, design, writing, acting, film, cooking and more · no degree needed
          </span>
        </div>
      </div>
      {open && (
        <div className="tree-node__children">
          <ul className="tree" aria-label="Professional courses">
            {short.map((c) => <TreeNode key={`course-${c.id}`} node={c} depth={depth + 1} />)}
          </ul>
        </div>
      )}
    </li>
  );
}

function TreeNode({ node, depth }) {
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

  const extra = edgeText(node.edge);
  const title = node.type === "career" ? <Link to={`/careers/${node.id}`}>{node.title}</Link>
    : node.type === "exam" ? <OfficialLink href={node.url}>{node.title}</OfficialLink> : node.title;

  return (
    <li className={`tree-node tree-node--${node.type}`}>
      <div className="tree-node__row">
        {node.has_children ? (
          <button type="button" className="tree-toggle" aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${node.title}`} onClick={toggle}>
            <span aria-hidden="true">{open ? "−" : "+"}</span>
          </button>
        ) : <span className="tree-toggle tree-toggle--leaf" aria-hidden="true" />}
        <div className="tree-node__body">
          <span className={`badge tree-badge tree-badge--${node.type}`}>{node.edge?.label || TYPE_LABEL[node.type]}</span>{" "}
          <span className="tree-node__title">{title}</span>
          {extra && <span className="tree-node__meta muted small">{extra}</span>}
        </div>
      </div>
      {open && (
        <div className="tree-node__children">
          {state.status === "loading" && <p className="muted small" role="status">Loading…</p>}
          {state.status === "error" && <p className="text-danger small" role="alert">{state.error}</p>}
          {state.status === "ready" && state.children.length === 0 && <p className="muted small">Nothing further recorded.</p>}
          {state.children.length > 0 && (
            <TreeList nodes={state.children} depth={depth + 1} label={`Options after ${node.title}`} keyPrefix={node.id} />
          )}
        </div>
      )}
    </li>
  );
}

export default function ExplorePage() {
  const { status: authStatus } = useAuth();
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
            <h1>Career explorer</h1>
            <p className="muted">Open any step to see where it leads: further study, careers, exams, promotions and switches.</p>
          </div>
        </div>
        {stages.status === "ready" && root.data && (
          <div className="toolbar">
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field__label" htmlFor="explore-stage">Start from</label>
              <select id="explore-stage" className="input" value={root.data.root.id}
                onChange={(e) => setParams({ stage: e.target.value })}>
                {stages.data.map((s) => <option key={s.stage_id} value={s.stage_id}>{s.name}</option>)}
              </select>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              {root.data.source === "profile" ? "Starting from your profile." : "Tip: log in to start from your own stage."}
            </p>
          </div>
        )}

        {root.status === "loading" && <Loading label="Loading explorer" />}
        {root.status === "error" && <ErrorNotice message={root.error} onRetry={root.reload} />}
        {root.status === "ready" && (
          <div className="card tree-card">
            <h2 className="tree-root">{root.data.root.title}</h2>
            {root.data.root.subtitle && <p className="muted small">{root.data.root.subtitle}</p>}
            <TreeList nodes={root.data.root.children} depth={1} label={`Options after ${root.data.root.title}`}
              keyPrefix={root.data.root.id} />
          </div>
        )}
      </div>
    </section>
  );
}
