import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorNotice, Loading, OfficialLink } from "../components/Status";
import { useAuth } from "../context/AuthContext";
import useRequest from "../hooks/useRequest";
import * as api from "../services/api";

const TYPE_LABEL = { stage: "Study", career: "Career", exam: "Exam" };

function edgeText(edge) {
  if (!edge) return null;
  const parts = [];
  if (edge.years) parts.push(`${edge.years} years`);
  if (edge.experience) parts.push(`after ${edge.experience} years`);
  if (edge.months) parts.push(`${edge.months} months`);
  if (edge.exams?.length) parts.push(`via ${edge.exams.join(" / ")}`);
  return parts.join(" · ");
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
            <ul className="tree" aria-label={`Options after ${node.title}`}>
              {state.children.map((child) => <TreeNode key={`${child.type}-${child.id}`} node={child} depth={depth + 1} />)}
            </ul>
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
            <ul className="tree" aria-label={`Options after ${root.data.root.title}`}>
              {root.data.root.children.map((child) => <TreeNode key={`${root.data.root.id}-${child.type}-${child.id}`} node={child} depth={1} />)}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
