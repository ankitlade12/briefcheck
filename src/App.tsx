import { useEffect, useRef, useState } from "react";
import {
  ROLES,
  TOPICS,
  boundaries,
  outcome,
  scenarioValues,
  diffReviews,
  assembleReview,
  validatePredicate,
} from "./engine.mjs";
import { exportData, htmlReport } from "./export.mjs";
import { carryReviewState } from "./review-state.mjs";
import { blankDocument, sampleDocuments, observedDocuments } from "./samples";

type Data = any;
const glyphs: Record<string, string> = {
  materials: "▤",
  review: "◈",
  coverage: "▦",
  history: "↺",
  workspace: "▧",
  export: "↗",
};
const labels: Record<string, string> = {
  materials: "Source materials",
  review: "Review & test",
  coverage: "Coverage",
  history: "Revision history",
  workspace: "Workspaces",
  export: "Export review",
};
async function api(path: string, body?: Data, method?: string) {
  const res = await fetch("/api" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={"badge " + tone}>{children}</span>;
}
function Icon({ name }: { name: string }) {
  return <span aria-hidden="true">{glyphs[name] || name}</span>;
}
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const d = ref.current;
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose}>
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function App() {
  const [tab, setTab] = useState("materials"),
    [title, setTitle] = useState("Untitled event"),
    [documents, setDocuments] = useState<Data[]>([
      blankDocument(),
      blankDocument(),
    ]),
    [runs, setRuns] = useState<Data[]>([]),
    [revisions, setRevisions] = useState<Data[]>([]),
    [clarifications, setClarifications] = useState<Data[]>([]);
  const [config, setConfig] = useState<Data>({
      aiEnabled: false,
      user: null,
      integrations: [],
    }),
    [mode, setMode] = useState("deterministic"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(""),
    [filter, setFilter] = useState("all"),
    [scenario, setScenario] = useState("180"),
    [track, setTrack] = useState("general");
  const [modal, setModal] = useState<Data>(null),
    [draft, setDraft] = useState(""),
    [reason, setReason] = useState(""),
    [policy, setPolicy] = useState(""),
    [decisionReason, setDecisionReason] = useState(""),
    [includeSources, setIncludeSources] = useState(false),
    [saved, setSaved] = useState<Data>(null),
    [savedFingerprint, setSavedFingerprint] = useState(""),
    [workspaces, setWorkspaces] = useState<Data[]>([]),
    [templates, setTemplates] = useState<Data[]>([]),
    [baseline, setBaseline] = useState(""),
    [historical, setHistorical] = useState<string | null>(null);
  const [authName, setAuthName] = useState(""),
    [password, setPassword] = useState(""),
    [shareName, setShareName] = useState(""),
    [shareRole, setShareRole] = useState("reviewer"),
    [importURL, setImportURL] = useState(""),
    [testFacts, setTestFacts] = useState("{}");
  const current = runs.at(-1),
    run = historical ? runs.find((r) => r.id === historical) : current;
  const stale =
    !!current &&
    (current.versions.length !== documents.length ||
      documents.some(
        (d) =>
          !current.versions.some(
            (v: Data) =>
              v.id === d.id &&
              v.text === d.text &&
              v.title === d.title &&
              v.role === d.role &&
              JSON.stringify(v.coverage) === JSON.stringify(d.coverage),
          ),
      ));
  const finding =
    run?.findings.find((f: Data) => f.id === selected) || run?.findings[0];
  const related =
    run?.requirements.filter((r: Data) =>
      finding?.requirementIds.includes(r.id),
    ) || [];
  const editable = !saved || saved.role !== "reviewer";
  const dirty = documents.some((d) => d.text) || runs.length > 0;
  const total = documents.reduce((sum, d) => sum + d.text.length, 0);
  const workspace = () => ({
    title,
    documents,
    runs,
    revisions,
    clarifications,
  });
  const unsaved = !!saved && JSON.stringify(workspace()) !== savedFingerprint;
  useEffect(() => {
    api("/config")
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty]);
  useEffect(() => {
    if (finding) {
      const rs = run.requirements.filter((r: Data) =>
        finding.requirementIds.includes(r.id),
      );
      const bs = rs.flatMap((r: Data) => boundaries(r.predicate));
      setScenario(String(finding.witness ?? bs.at(-1) ?? 180));
      setTrack(finding.scope);
      setDecisionReason(run.decisions?.[finding.id]?.reason || "");
    }
  }, [finding?.id, run?.id]);
  async function action(fn: () => Promise<void>) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function updateDoc(id: string, patch: Data) {
    setDocuments((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    setHistorical(null);
  }
  function loadSample(kind = "synthetic") {
    if (dirty) {
      setModal({ type: "replace", kind });
      return;
    }
    replaceSample(kind);
  }
  function replaceSample(kind: string) {
    setDocuments(kind === "observed" ? observedDocuments() : sampleDocuments());
    setTitle(
      kind === "observed" ? "Build With AI: Basics" : "Field Notes Hackathon",
    );
    setRuns([]);
    setRevisions([]);
    setClarifications([]);
    setSaved(null);
    setHistorical(null);
    setModal(null);
    setTab("materials");
    setMessage(
      kind === "observed"
        ? "Dated, attributed excerpts loaded. Run review to analyze them."
        : "Synthetic source materials loaded. Run review to analyze them.",
    );
  }
  async function review() {
    await action(async () => {
      const next = await api(current ? "/reviews/recheck" : "/reviews", {
        documents,
        mode,
      });
      carryReviewState(current, next);
      setRuns((rs) => [...rs, next]);
      setSelected(next.findings[0]?.id || "");
      setHistorical(null);
      setTab("review");
      setMessage(
        `Review complete: ${next.findings.length} findings, ${next.errors.length} unresolved extractions.`,
      );
    });
  }
  function saveScenario() {
    if (!run || !finding) return;
    const n = Number(scenario);
    if (
      !scenario.trim() ||
      !Number.isFinite(n) ||
      (finding.topic === "team size" && !Number.isInteger(n)) ||
      (finding.topic !== "deadline" && n < 0)
    ) {
      setError(
        "Enter a valid nonnegative number; team size must be a whole number.",
      );
      return;
    }
    const facts = { [finding.topic]: n, track };
    const s = {
      id: crypto.randomUUID(),
      runId: run.id,
      findingId: finding.id,
      topic: finding.topic,
      scope: finding.scope,
      facts,
      assumptions: related.flatMap((r: Data) => r.assumptions),
      at: new Date().toISOString(),
      evaluatorVersion: run.engineVersion,
      predicates: related.map((r: Data) => ({
        id: r.id,
        predicate: r.predicate,
                                            items: r.items,
        versionId: r.evidence.versionId,
      })),
      outcomes: related.map((r: Data) => ({
        requirementId: r.id,
        versionId: r.evidence.versionId,
        result: outcome(r, facts),
      })),
    };
    setRuns((rs) =>
      rs.map((r) =>
        r.id === run.id ? { ...r, scenarios: [...r.scenarios, s] } : r,
      ),
    );
    setMessage(
      "Scenario saved to this review. It will rerun against the next revision.",
    );
  }
  async function decision(status: string) {
    if (status === "dismissed" && !decisionReason.trim()) {
      setError("Add a reason before dismissing a finding.");
      return;
    }
    await action(async () => {
      let d = {
        status,
        reason: decisionReason,
        at: new Date().toISOString(),
        reviewer: config.user?.name || "Session organizer",
      };
      const storedRun = saved && JSON.parse(savedFingerprint || '{}').runs?.some((r:Data) => r.id === run.id);
      if(saved && !storedRun && saved.role === 'reviewer') throw new Error('An editor must save this new review before you can record a shared decision.');
      if (storedRun) {
        const result = await api(`/workspaces/${saved.id}/decisions`, {
          revision: saved.revision,
          runId: run.id,
          findingId: finding.id,
          status,
          reason: decisionReason,
        });
        d = result.decision;
        setSaved({ ...saved, revision: result.revision });
      }
      setRuns((rs) =>
        rs.map((r) =>
          r.id === run.id
            ? { ...r, decisions: { ...r.decisions, [finding.id]: d } }
            : r,
        ),
      );
      setMessage(saved && !storedRun ? "Decision recorded locally. Save the workspace to share this new review and decision." : "Decision recorded with its source version.");
    });
  }
  function openEdit(d: Data) {
    setDraft(d.text);
    setReason("");
    setPolicy("");
    setModal({ type: "edit", document: d });
  }
  function applySuggestion() {
    if (!policy || !modal?.document) return;
    const r = related.find(
      (r: Data) => r.documentId === modal.document.id && r.topic === "duration",
    );
    if (!r) {
      setError(
        "Edit this document manually; no supported duration passage is selected.",
      );
      return;
    }
    if (r.conditions.length || r.exceptions.length || r.scope !== "general") {
      setError(
        "This passage has conditions or exceptions. Edit it manually to preserve them.",
      );
      return;
    }
    const b = boundaries(r.predicate).at(-1);
    const phrase =
      policy === "include"
        ? `Demo video must be at most ${b} seconds.`
        : policy === "exclude"
          ? `Demo video must be under ${b} seconds.`
          : `Demo video should be under ${b} seconds.`;
    setDraft(
      modal.document.text.slice(0, r.evidence.start) +
        phrase +
        modal.document.text.slice(r.evidence.end),
    );
    setReason(
      `Organizer selected: ${policy} the exact boundary. This may change policy meaning.`,
    );
  }
  function saveDraft() {
    if (!draft.trim() || !reason.trim()) {
      setError("Keep nonempty source text and record a reason for the change.");
      return;
    }
    const d = modal.document;
    if (draft === d.text) {
      setModal(null);
      return;
    }
    const previous = current?.versions.find((v: Data) => v.id === d.id);
    let start = 0;
    while (
      start < d.text.length &&
      start < draft.length &&
      d.text[start] === draft[start]
    )
      start++;
    let endOld = d.text.length,
      endNew = draft.length;
    while (
      endOld > start &&
      endNew > start &&
      d.text[endOld - 1] === draft[endNew - 1]
    ) {
      endOld--;
      endNew--;
    }
    setRevisions((rs) => [
      ...rs,
      {
        id: crypto.randomUUID(),
        documentId: d.id,
        title: d.title,
        parentVersionId: previous?.versionId || null,
        beforeText: d.text,
        afterText: draft,
        changedSpans: { start, oldEnd: endOld, newEnd: endNew },
        reason,
        at: new Date().toISOString(),
      },
    ]);
    updateDoc(d.id, {
      text: draft,
      parentVersionId: previous?.versionId,
      inputMethod: "local draft",
    });
    setModal(null);
    setMessage(
      "Draft saved. Previous review is stale until you rerun. The external source was not changed.",
    );
  }
  function undo(rev: Data) {
    const d = documents.find((d) => d.id === rev.documentId);
    if (!d || d.text !== rev.afterText) {
      setError(
        "This is not the latest applicable edit. Undo newer changes first.",
      );
      return;
    }
    setRevisions((rs) => [
      ...rs,
      {
        id: crypto.randomUUID(),
        documentId: d.id,
        title: d.title,
        beforeText: d.text,
        afterText: rev.beforeText,
        reason: `Undo ${rev.id}`,
        undoOf: rev.id,
        at: new Date().toISOString(),
      },
    ]);
    updateDoc(d.id, { text: rev.beforeText, inputMethod: "local draft" });
    setMessage("Edit undone as a new revision. Rerun review to check it.");
  }
  async function refreshWorkspace() {
    await action(async () => {
      setWorkspaces(await api("/workspaces"));
      setTemplates(await api("/templates"));
    });
  }
  async function saveWorkspace() {
    await action(async () => {
      const result = await api(
        saved ? `/workspaces/${saved.id}` : "/workspaces",
        { ...workspace(), revision: saved?.revision },
        saved ? "PUT" : "POST",
      );
      setSaved(result);
      setSavedFingerprint(JSON.stringify(workspace()));
      setMessage("Workspace saved privately on this server.");
      setWorkspaces(await api("/workspaces"));
    });
  }
  async function openWorkspace(id: string) {
    await action(async () => {
      const data = await api(`/workspaces/${id}`);
      setTitle(data.title);
      setDocuments(data.documents);
      setRuns(data.runs || []);
      setRevisions(data.revisions || []);
      setClarifications(data.clarifications || []);
      setSaved({ id: data.id, revision: data.revision, role: data.role });
      setSavedFingerprint(
        JSON.stringify({
          title: data.title,
          documents: data.documents,
          runs: data.runs || [],
          revisions: data.revisions || [],
          clarifications: data.clarifications || [],
        }),
      );
      setHistorical(null);
      setTab("review");
      setModal(null);
      setMessage(`Opened private workspace as ${data.role}.`);
    });
  }
  async function importSource(kind: string, file?: File) {
    await action(async () => {
      let data;
      if (kind === "url") data = await api("/import/url", { url: importURL });
      else {
        if (!file) return;
        const res = await fetch("/api/import/pdf", {
          method: "POST",
          headers: {
            "Content-Type": "application/pdf",
            "X-File-Name": encodeURIComponent(file.name),
          },
          body: file,
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }
      setDocuments((ds) =>
        ds.map((d) => (d.id === modal.document.id ? { ...d, ...data } : d)),
      );
      setModal(null);
      setMessage(
        "Source imported. Inspect the text and provenance before analysis.",
      );
    });
  }
  const changes = diffReviews(
    baseline ? runs.find((r) => r.id === baseline) : runs.at(-2),
    current,
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("materials");
          }}
        >
          <span className="brand-mark">
            b<span>✓</span>
          </span>
          briefcheck<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">ORGANIZER WORKSPACE</div>
        <div className="event-switch">
          <span className="event-icon">F</span>
          <div>
            <strong>{title}</strong>
            <small>
              {saved ? "Private saved workspace" : "Session workspace"}
            </small>
          </div>
        </div>
        <nav aria-label="Workspace navigation">
          {Object.keys(labels).map((key) => (
            <button
              aria-label={labels[key]}
              title={labels[key]}
              key={key}
              className={tab === key ? "nav-item active" : "nav-item"}
              onClick={() => {
                setTab(key);
                if (key === "workspace" && config.user) void refreshWorkspace();
              }}
            >
              <Icon name={key} />
              {labels[key]}
              {key === "review" && current && (
                <span className="nav-count">{current.findings.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-dot" />
          <strong>Your sources. Your decision.</strong>
          <p>
            {saved
              ? "Private storage on this server."
              : "Session memory by default."}
            <br />
            Export before closing.
          </p>
          <button
            className="text-button"
            onClick={() => setModal({ type: "about" })}
          >
            About this review tool ↗
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            Workspace <span>/</span> {labels[tab]}
          </div>
          <div className="top-actions">
            <span className="session-status">
              <i />
              {saved
                ? unsaved
                  ? "Unsaved changes"
                  : "Saved privately"
                : "Not saved"}
            </span>
            <button
              className="button small"
              onClick={() => {
                setTab("workspace");
                if (config.user) void refreshWorkspace();
              }}
            >
              {config.user ? config.user.name : "Sign in to save"}
            </button>
            <div className="avatar" aria-hidden="true">
              {(config.user?.name || "O").slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">CLARITY BEFORE LAUNCH</div>
              <h1>
                {tab === "materials"
                  ? "Better briefs. Fewer gray areas."
                  : tab === "review"
                    ? "Make every requirement clear."
                    : tab === "coverage"
                      ? "Know what was checked."
                      : tab === "history"
                        ? "Every change, accounted for."
                        : tab === "workspace"
                          ? "A place for your review team."
                          : "Take the evidence with you."}
              </h1>
              <p>
                {tab === "materials"
                  ? "Bring your event instructions together. Find the gaps before your participants do."
                  : tab === "review"
                    ? "Follow the evidence, test an example, and make an informed correction."
                    : tab === "coverage"
                      ? "Explicit coverage and unresolved interpretations, without a misleading readiness score."
                      : tab === "history"
                        ? "Original sources stay intact. Local drafts and review runs tell the whole story."
                        : tab === "workspace"
                          ? "Save privately, collaborate with named reviewers, and reuse your event templates."
                          : "An auditable record of sources, decisions, and the tests behind them."}
              </p>
            </div>
            {tab !== "materials" && (
              <button className="button" onClick={() => setTab("materials")}>
                ← Source materials
              </button>
            )}
          </div>
          <div aria-live="polite" role="status">
            {busy && (
              <div className="notice progress">
                <span className="spinner" />
                Working… Your input remains here.
              </div>
            )}
            {message && <div className="notice success">✓ {message}</div>}
          </div>
          {error && (
            <div role="alert" className="notice error">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}
          {stale && (
            <div className="notice warning">
              <strong>Unchecked changes.</strong> Results below belong to the
              previous source versions.
              <button disabled={busy} onClick={() => void review()}>
                Rerun review →
              </button>
            </div>
          )}
          {historical && (
            <div className="notice warning">
              <strong>Historical review.</strong> Showing the saved run from{" "}
              {new Date(run.createdAt).toLocaleString()}.
              <button onClick={() => setHistorical(null)}>
                Return to latest
              </button>
            </div>
          )}
          {tab === "materials" && (
            <>
              <div className="intro-grid">
                <section className="sample-callout">
                  <span className="sample-art" aria-hidden="true">
                    ▤<span>✓</span>
                  </span>
                  <div>
                    <h3>See a small difference make a big difference.</h3>
                    <p>
                      Try two synthetic event briefs with a three-minute
                      boundary and a missing judging criterion.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => loadSample()}
                    >
                      Load sample materials <span>↗</span>
                    </button>
                  </div>
                  <Badge>LIVE CHECKS · SYNTHETIC TEXT</Badge>
                </section>
                <section className="mini-note">
                  <span>01 — 04</span>
                  <h3>Only what you supply.</h3>
                  <p>
                    Two to four sources. Exact passages.
                    <br />
                    No website-wide compliance claims.
                  </p>
                </section>
              </div>
              <section className="panel intake">
                <div className="section-heading">
                  <div>
                    <h2>
                      <span className="step">01</span> Add your source materials
                    </h2>
                    <p>
                      Paste text or import a public page or text PDF. Label each
                      source’s role and expected coverage.
                    </p>
                  </div>
                  <span className={total > 40000 ? "counter over" : "counter"}>
                    {total.toLocaleString()} <span>/ 40,000 characters</span>
                  </span>
                </div>
                <label className="event-name">
                  Event name
                  <input
                    value={title}
                    maxLength={200}
                    disabled={!editable}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Your hackathon or challenge"
                  />
                </label>
                <div className="document-grid">
                  {documents.map((d, index) => (
                    <article className="document-card" key={d.id}>
                      <div className="document-top">
                        <span className="doc-number">
                          SOURCE {String(index + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <button
                            className="icon-button"
                            aria-label={`Move ${d.title || "source"} earlier`}
                            disabled={index === 0 || !editable}
                            onClick={() =>
                              setDocuments((ds) => {
                                const next = [...ds];
                                [next[index - 1], next[index]] = [
                                  next[index],
                                  next[index - 1],
                                ];
                                return next;
                              })
                            }
                          >
                            ↑
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Remove ${d.title || "source"}`}
                            disabled={!editable}
                            onClick={() =>
                              setModal({ type: "remove", document: d })
                            }
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      <div className="field-row">
                        <label>
                          Document title
                          <input
                            value={d.title}
                            disabled={!editable}
                            maxLength={200}
                            onChange={(e) =>
                              updateDoc(d.id, { title: e.target.value })
                            }
                            placeholder={
                              index === 0
                                ? "e.g. Event overview"
                                : "e.g. Official rules"
                            }
                          />
                        </label>
                        <label>
                          Source role
                          <select
                            value={d.role}
                            disabled={!editable}
                            onChange={(e) =>
                              updateDoc(d.id, { role: e.target.value })
                            }
                          >
                            {ROLES.map((r) => (
                              <option key={r}>{r}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label>
                        Source URL{" "}
                        <span className="optional">
                          optional · not fetched unless imported
                        </span>
                        <input
                          type="url"
                          value={d.url}
                          disabled={!editable}
                          onChange={(e) =>
                            updateDoc(d.id, { url: e.target.value })
                          }
                          placeholder="https://your-event.com/rules"
                        />
                      </label>
                      <label>
                        Document text
                        <textarea
                          value={d.text}
                          disabled={!editable}
                          readOnly={!!current}
                          onChange={(e) =>
                            updateDoc(d.id, {
                              text: e.target.value,
                              inputMethod: "paste",
                            })
                          }
                          placeholder="Paste the relevant event instructions here…"
                          rows={9}
                        />
                      </label>
                      <div className="document-tools">
                        <button
                          className="text-button"
                          disabled={!editable}
                          onClick={() => {
                            setImportURL(d.url);
                            setModal({ type: "import", document: d });
                          }}
                        >
                          ↓ Import URL / PDF
                        </button>
                        <span>{d.text.length.toLocaleString()} characters</span>
                      </div>
                      {d.provenance && (
                        <details className="provenance">
                          <summary>Import provenance & warnings</summary>
                          <pre>{JSON.stringify(d.provenance, null, 2)}</pre>
                        </details>
                      )}
                      <div className="coverage-options">
                        <strong>Expected to list all:</strong>
                        {["criteria", "deliverables"].map((topic) => (
                          <label key={topic}>
                            <input
                              type="checkbox"
                              disabled={!editable}
                              checked={d.coverage[topic]}
                              onChange={(e) =>
                                updateDoc(d.id, {
                                  coverage: {
                                    ...d.coverage,
                                    [topic]: e.target.checked,
                                  },
                                })
                              }
                            />
                            {topic === "criteria"
                              ? "Judging criteria"
                              : "Deliverables"}
                          </label>
                        ))}
                      </div>
                      {current && (
                        <button
                          className="text-button"
                          disabled={!editable}
                          onClick={() => openEdit(d)}
                        >
                          Open versioned draft editor →
                        </button>
                      )}
                    </article>
                  ))}
                </div>
                <button
                  className="add-document"
                  disabled={documents.length >= 4 || !editable}
                  onClick={() => setDocuments((ds) => [...ds, blankDocument()])}
                >
                  ＋ Add another source <span>{documents.length}/4</span>
                </button>
              </section>
              <section className="review-bar">
                <div>
                  <label className="inline-label">
                    Analysis mode
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                    >
                      <option value="deterministic">
                        Deterministic · pattern checks
                      </option>
                      <option value="ai" disabled={!config.aiEnabled}>
                        AI-assisted · structured extraction
                        {!config.aiEnabled ? " (server setup needed)" : ""}
                      </option>
                    </select>
                  </label>
                  <p>
                    {mode === "ai"
                      ? "Supplied text is sent to the configured model provider. Check its retention settings."
                      : "Local server processing. No source text is sent to an AI provider."}
                  </p>
                </div>
                <button
                  className="button primary large"
                  disabled={busy || documents.length < 2}
                  onClick={() => void review()}
                >
                  Review instructions <span>→</span>
                </button>
              </section>
              <div className="footnote">
                <span>◈ Evidence first. Organizer decides.</span>
                <button
                  className="text-button"
                  onClick={() => loadSample("observed")}
                >
                  Load dated Devpost criteria excerpts
                </button>
              </div>
            </>
          )}
          {tab === "review" &&
            (!run ? (
              <Empty
                title="Your first review starts with two sources."
                text="Add your overview and rules, then run the same checks used by the sample."
                onClick={() => setTab("materials")}
                action="Add source materials"
              />
            ) : (
              <>
                <div className="review-summary">
                  <div>
                    <span className="summary-number">
                      {run.findings.length.toString().padStart(2, "0")}
                    </span>
                    <div>
                      <strong>
                        {run.findings.length
                          ? "Findings to review"
                          : "No findings in the completed checks"}
                      </strong>
                      <p>
                        {run.versions.length} sources ·{" "}
                        {run.mode === "ai"
                          ? "Live model extraction"
                          : "Deterministic extraction"}{" "}
                        · {run.errors.length} unresolved
                      </p>
                    </div>
                  </div>
                  <Badge tone={run.status === "partial" ? "amber" : "green"}>
                    {run.status === "partial"
                      ? "PARTIAL REVIEW"
                      : "CHECKS COMPLETED"}
                  </Badge>
                  <button
                    className="text-button"
                    onClick={() => setTab("coverage")}
                  >
                    View coverage ↗
                  </button>
                </div>
                <div className="review-layout">
                  <aside className="finding-list">
                    <div className="list-heading">
                      <h3>Findings</h3>
                      <select
                        aria-label="Filter findings"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">All</option>
                        <option value="open">Open</option>
                        <option value="accepted">Accepted</option>
                        <option value="dismissed">Dismissed</option>
                        <option value="deferred">Deferred</option>
                      </select>
                    </div>
                    {run.findings
                      .filter(
                        (f: Data) =>
                          filter === "all" ||
                          (run.decisions?.[f.id]?.status || "open") === filter,
                      )
                      .map((f: Data) => (
                        <button
                          className={
                            "finding-item " +
                            (finding?.id === f.id ? "selected" : "")
                          }
                          key={f.id}
                          onClick={() => setSelected(f.id)}
                        >
                          <div>
                            <Badge
                              tone={f.priority === "High" ? "red" : "amber"}
                            >
                              {f.type}
                            </Badge>
                            <small>
                              {run.decisions?.[f.id]?.status || "open"}
                            </small>
                          </div>
                          <strong>
                            {f.topic === "duration"
                              ? "Where does the time limit land?"
                              : f.topic === "criteria"
                                ? "A criterion is missing"
                                : f.topic === "deadline"
                                  ? "Different deadline guidance"
                                  : f.topic === "team size"
                                    ? "Check the team-size boundary"
                                    : "Align the deliverables"}
                          </strong>
                          <p>
                            {f.scope === "general"
                              ? "General event guidance"
                              : f.scope + " track"}
                          </p>
                          <span className="finding-arrow">↗</span>
                        </button>
                      ))}
                    {!run.findings.length && (
                      <p className="muted pad">
                        No findings in supported comparisons. Review coverage
                        for untested content.
                      </p>
                    )}
                    <div className="list-footer">
                      A finding is a question to resolve,
                      <br />
                      not an eligibility verdict.
                    </div>
                  </aside>
                  <div className="finding-detail">
                    {finding ? (
                      <>
                        <section className="panel issue-panel">
                          <div className="section-heading">
                            <div className="badge-row">
                              <Badge tone="amber">
                                {finding.type.toUpperCase()}
                              </Badge>
                              <Badge>{finding.topic}</Badge>
                            </div>
                            <span className="muted">
                              {finding.priority} priority
                            </span>
                          </div>
                          <h2>
                            {finding.topic === "duration"
                              ? "Where does the duration boundary land?"
                              : finding.topic === "criteria"
                                ? "Keep the judging rubric in sync."
                                : `Review the ${finding.topic} guidance.`}
                          </h2>
                          <p className="issue-reason">{finding.reason}</p>
                          <div className="evidence-grid">
                            {finding.evidence.map((e: Data, i: number) => {
                              const d = run.versions.find(
                                (v: Data) => v.versionId === e.versionId,
                              );
                              return (
                                <article className="evidence-card" key={i}>
                                  <div>
                                    <span className="eyebrow">
                                      SOURCE {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <Badge tone="green">Verified source</Badge>
                                  </div>
                                  <h4>{d?.title}</h4>
                                  <span className="muted">{d?.role}</span>
                                  <blockquote>
                                    {e.quote.length > 1600
                                      ? e.quote.slice(0, 1600) + "…"
                                      : e.quote}
                                  </blockquote>
                                  <button
                                    className="text-button"
                                    onClick={() =>
                                      setModal({
                                        type: "evidence",
                                        evidence: e,
                                        document: d,
                                      })
                                    }
                                  >
                                    Inspect exact passage ↗
                                  </button>
                                  {editable &&
                                    !historical &&
                                    documents.some((x) => x.id === d?.id) && (
                                      <button
                                        className="text-button"
                                        onClick={() =>
                                          openEdit(
                                            documents.find(
                                              (x) => x.id === d.id,
                                            ),
                                          )
                                        }
                                      >
                                        Edit local draft →
                                      </button>
                                    )}
                                </article>
                              );
                            })}
                          </div>
                          <div className="interpretation-note">
                            ⓘ Source text is verified. Interpretation still
                            needs organizer review.
                          </div>
                        </section>
                        {related.some((r: Data) => r.predicate) && (
                          <section className="panel scenario-panel">
                            <div className="section-heading">
                              <div>
                                <h2>
                                  <span className="step">02</span> Test the
                                  smallest example
                                </h2>
                                <p>
                                  Change one fact. Compare the guidance side by
                                  side.
                                </p>
                              </div>
                              <Badge>DETERMINISTIC TEST</Badge>
                            </div>
                            <div className="scenario-controls">
                              <label>
                                {finding.topic === "duration"
                                  ? "Video duration (seconds)"
                                  : finding.topic === "team size"
                                    ? "Team size (people)"
                                    : "Deadline instant (Unix milliseconds)"}
                                <input
                                  type="number"
                                  value={scenario}
                                  step={
                                    finding.topic === "team size" ? "1" : "any"
                                  }
                                  onChange={(e) => setScenario(e.target.value)}
                                />
                              </label>
                              <label>
                                Track / scope
                                <input
                                  value={track}
                                  onChange={(e) => setTrack(e.target.value)}
                                />
                              </label>
                              <div className="boundary-buttons">
                                {scenarioValues(related, finding.topic)
                                  .slice(-6)
                                  .map((v) => (
                                    <button
                                      className={
                                        Number(scenario) === v
                                          ? "boundary active"
                                          : "boundary"
                                      }
                                      key={v}
                                      onClick={() => setScenario(String(v))}
                                    >
                                      {finding.topic === "deadline"
                                        ? new Date(v).toISOString()
                                        : `${v}${finding.topic === "duration" ? "s" : ""}`}
                                    </button>
                                  ))}
                              </div>
                            </div>
                            <div className="table-wrap">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Source</th>
                                    <th>Normalized predicate</th>
                                    <th>Result for this fact</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {related
                                    .filter((r: Data) => r.predicate)
                                    .map((r: Data) => (
                                      <tr key={r.id}>
                                        <td>
                                          <strong>
                                            {
                                              run.versions.find(
                                                (v: Data) =>
                                                  v.id === r.documentId,
                                              )?.title
                                            }
                                          </strong>
                                          <small>
                                            {r.modality} · {r.scope}
                                          </small>
                                        </td>
                                        <td>
                                          <code>
                                            {predicateLabel(r.predicate)}
                                          </code>
                                        </td>
                                        <td>
                                          <span
                                            className={
                                              "outcome " +
                                              (outcome(r, {
                                                [finding.topic]:
                                                  scenario.trim() &&
                                                  Number(scenario) >= 0 &&
                                                  (finding.topic !==
                                                    "team size" ||
                                                    Number.isInteger(
                                                      Number(scenario),
                                                    ))
                                                    ? Number(scenario)
                                                    : null,
                                                track,
                                              }).startsWith("Meets")
                                                ? "meets"
                                                : "outside")
                                            }
                                          >
                                            {outcome(r, {
                                              [finding.topic]:
                                                scenario.trim() &&
                                                Number(scenario) >= 0 &&
                                                (finding.topic !==
                                                  "team size" ||
                                                  Number.isInteger(
                                                    Number(scenario),
                                                  ))
                                                  ? Number(scenario)
                                                  : null,
                                              track,
                                            })}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                            <details>
                              <summary>
                                Assumptions & extraction details
                              </summary>
                              {related.map((r: Data) => (
                                <div key={r.id}>
                                  <p>{r.assumptions.join(" ")}</p>
                                  <pre>
                                    {JSON.stringify(
                                      {
                                        scope: r.scope,
                                        modality: r.modality,
                                        conditions: r.conditions,
                                        exceptions: r.exceptions,
                                        predicate: r.predicate,
                                            items: r.items,
                                      },
                                      null,
                                      2,
                                    )}
                                  </pre>
                                  <button
                                    className="text-button"
                                    disabled={!!historical || !editable}
                                    onClick={() => {
                                      setDraft(
                                        JSON.stringify(
                                          {
                                            scope: r.scope,
                                            modality: r.modality,
                                            predicate: r.predicate,
                                            items: r.items,
                                          },
                                          null,
                                          2,
                                        ),
                                      );
                                      setReason("");
                                      setModal({
                                        type: "extraction",
                                        requirement: r,
                                      });
                                    }}
                                  >
                                    Correct this interpretation
                                  </button>
                                </div>
                              ))}
                            </details>
                            <div className="scenario-bottom">
                              <p>
                                These outcomes apply only to the stated
                                requirement.
                              </p>
                              <button className="button" onClick={saveScenario}>
                                Save scenario & results
                              </button>
                            </div>
                          </section>
                        )}
                        <section className="panel decision-panel">
                          <div>
                            <h2>
                              <span className="step">03</span> Record your
                              decision
                            </h2>
                            <p>
                              Accept for correction, dismiss with a reason, or
                              defer for another reviewer.
                            </p>
                          </div>
                          {run.decisions?.[finding.id]?.needsReview && (
                            <div className="notice warning">
                              Source changed. Reconfirm the previous decision.
                            </div>
                          )}
                          <label>
                            Decision note
                            <textarea
                              rows={2}
                              value={decisionReason}
                              onChange={(e) =>
                                setDecisionReason(e.target.value)
                              }
                              placeholder="Why does this need a change—or why is the difference intentional?"
                            />
                          </label>
                          <div className="decision-actions">
                            {["accepted", "dismissed", "deferred"].map(
                              (status) => (
                                <button
                                  disabled={busy || !!historical}
                                  className={
                                    "button " +
                                    (status === "accepted" ? "primary" : "")
                                  }
                                  key={status}
                                  onClick={() => void decision(status)}
                                >
                                  {status === "accepted"
                                    ? "Accept finding"
                                    : status === "dismissed"
                                      ? "Dismiss with reason"
                                      : "Defer"}
                                </button>
                              ),
                            )}
                            <span className="muted">
                              Current:{" "}
                              {run.decisions?.[finding.id]?.status || "open"}
                            </span>
                          </div>
                          {editable && (
                            <button
                              className="text-button"
                              onClick={() => {
                                setDraft("");
                                setModal({
                                  type: "clarification",
                                  findingId: finding.id,
                                });
                              }}
                            >
                              Write an organizer-approved clarification →
                            </button>
                          )}
                        </section>
                      </>
                    ) : (
                      <section className="panel">
                        <h2>No open discrepancy to inspect.</h2>
                        <p>
                          Check coverage and unresolved interpretations before
                          relying on this review.
                        </p>
                      </section>
                    )}
                    {run.errors.length > 0 && (
                      <section className="panel unresolved">
                        <h3>Unresolved extractions ({run.errors.length})</h3>
                        {run.errors.map((e: Data, i: number) => (
                          <p key={i}>⚑ {e.message}</p>
                        ))}
                      </section>
                    )}
                  </div>
                </div>
              </>
            ))}
          {tab === "coverage" &&
            (!current ? (
              <Empty
                title="Coverage appears after your first review."
                text="The report distinguishes extracted requirements from content that remains unreviewed."
                onClick={() => setTab("materials")}
                action="Add sources"
              />
            ) : (
              <>
                <section className="panel">
                  <div className="section-heading">
                    <h2>Supplied-document coverage</h2>
                    <Badge>{current.mode.toUpperCase()}</Badge>
                  </div>
                  <p className="muted">
                    Counts represent supported extractions, not a guarantee that
                    every requirement was understood. A dash means no supported
                    extraction.
                  </p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Document</th>
                          {TOPICS.map((t) => (
                            <th key={t}>{t}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {current.coverage.map((c: Data) => (
                          <tr key={c.documentId}>
                            <td>{c.title}</td>
                            {c.topics.map((t: Data) => (
                              <td key={t.topic}>
                                {t.extracted || "—"}
                                {t.unresolved > 0 && (
                                  <small className="amber-text">
                                    {t.unresolved} unresolved
                                  </small>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="limits-list">
                    {current.limitations.map((l: string) => (
                      <p key={l}>ⓘ {l}</p>
                    ))}
                  </div>
                  <h3>Source-to-requirement map</h3>
                  <DependencyMap review={current} />
                  <h3>Extracted requirements</h3>
                  {current.requirements.map((r: Data) => (
                    <details key={r.id}>
                      <summary>
                        {r.topic} · {r.scope} · {r.modality} · {r.status}
                      </summary>
                      <blockquote>{r.evidence.quote}</blockquote>
                      <pre>
                        {JSON.stringify(
                          {
                            predicate: r.predicate,
                                            items: r.items,
                            conditions: r.conditions,
                            exceptions: r.exceptions,
                            assumptions: r.assumptions,
                          },
                          null,
                          2,
                        )}
                      </pre>
                      {r.predicate && (
                        <button
                          className="button"
                          onClick={() => {
                            setTestFacts(
                              JSON.stringify(
                                {
                                  [r.topic]: boundaries(r.predicate)[0],
                                  track: r.scope,
                                },
                                null,
                                2,
                              ),
                            );
                            setModal({ type: "predicate", requirement: r });
                          }}
                        >
                          Test this requirement
                        </button>
                      )}
                      <button
                        className="text-button"
                        disabled={!editable}
                        onClick={() => {
                          setDraft(
                            JSON.stringify(
                              {
                                scope: r.scope,
                                modality: r.modality,
                                predicate: r.predicate,
                                            items: r.items,
                              },
                              null,
                              2,
                            ),
                          );
                          setReason("");
                          setModal({ type: "extraction", requirement: r });
                        }}
                      >
                        Correct interpretation
                      </button>
                    </details>
                  ))}
                </section>
                <section className="panel">
                  <h2>Compare with a baseline</h2>
                  <label>
                    Baseline review
                    <select
                      value={baseline}
                      onChange={(e) => setBaseline(e.target.value)}
                    >
                      <option value="">Previous run</option>
                      {runs.slice(0, -1).map((r) => (
                        <option key={r.id} value={r.id}>
                          {new Date(r.createdAt).toLocaleString()} ·{" "}
                          {r.findings.length} findings
                        </option>
                      ))}
                    </select>
                  </label>
                  {runs.length < 2 ? (
                    <p>Make a local edit and rerun to compare outcomes.</p>
                  ) : (
                    <div className="change-list">
                      {changes.map((c: Data) => (
                        <div key={c.finding.id}>
                          <Badge
                            tone={
                              c.state === "resolved"
                                ? "green"
                                : c.state === "unresolved"
                                  ? "amber"
                                  : "neutral"
                            }
                          >
                            {c.state}
                          </Badge>
                          <strong>
                            {c.finding.topic} · {c.finding.type}
                          </strong>
                          {c.needsDecisionReview && (
                            <small>
                              Decision needs review after source change
                            </small>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <h3>Saved scenario reruns</h3>
                  {current.scenarios.length ? (
                    current.scenarios.map((s: Data) => (
                      <details key={s.id}>
                        <summary>
                          {s.topic} · {JSON.stringify(s.facts)} ·{" "}
                          {s.stale
                            ? "unsupported / stale"
                            : s.rerunOf
                              ? "rerun"
                              : "saved"}
                        </summary>
                        <pre>{JSON.stringify(s.outcomes, null, 2)}</pre>
                      </details>
                    ))
                  ) : (
                    <p className="muted">
                      Save a boundary scenario from a finding to track it
                      through edits.
                    </p>
                  )}
                </section>
              </>
            ))}
          {tab === "history" && (
            <>
              <section className="panel">
                <h2>Review runs</h2>
                {runs.length ? (
                  runs.map((r, i) => (
                    <div className="history-row" key={r.id}>
                      <span className="timeline-index">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <strong>
                          {new Date(r.createdAt).toLocaleString()}
                        </strong>
                        <p>
                          {r.findings.length} findings · {r.errors.length}{" "}
                          unresolved · {r.mode} · {r.timingMs} ms
                        </p>
                      </div>
                      <button
                        className="button"
                        onClick={() => {
                          setHistorical(r.id);
                          setSelected(r.findings[0]?.id || "");
                          setTab("review");
                        }}
                      >
                        Inspect saved run
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="muted">
                    Your first completed review will appear here.
                  </p>
                )}
              </section>
              <section className="panel">
                <h2>Local revisions</h2>
                {revisions.length ? (
                  revisions.map((r) => (
                    <div className="history-row" key={r.id}>
                      <span className="timeline-index">↳</span>
                      <div>
                        <strong>{r.title}</strong>
                        <p>{r.reason}</p>
                        <small>
                          {new Date(r.at).toLocaleString()} ·{" "}
                          {r.parentVersionId || "Session draft"}
                        </small>
                        <details>
                          <summary>Before / after</summary>
                          <div className="evidence-grid">
                            <pre>{r.beforeText}</pre>
                            <pre>{r.afterText}</pre>
                          </div>
                        </details>
                      </div>
                      <button
                        className="button"
                        disabled={
                          !editable ||
                          documents.find((d) => d.id === r.documentId)?.text !==
                            r.afterText
                        }
                        onClick={() => undo(r)}
                      >
                        Undo edit
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="muted">
                    Use the draft editor to record a reversible correction.
                  </p>
                )}
              </section>
              <section className="panel">
                <h2>Organizer-approved clarifications</h2>
                {clarifications.length ? (
                  clarifications.map((c) => (
                    <article key={c.id}>
                      <Badge tone="green">Organizer decision</Badge>
                      <p>{c.text}</p>
                      <small>
                        {c.at} · source review {c.runId}
                      </small>
                    </article>
                  ))
                ) : (
                  <p className="muted">
                    Approved wording will appear here with its source review.
                  </p>
                )}
              </section>
            </>
          )}
          {tab === "workspace" && (
            <div className="workspace-grid">
              {!config.user ? (
                <section className="panel">
                  <h2>Save your work privately.</h2>
                  <p>
                    Anonymous reviews stay in session memory. An account saves
                    explicitly to this server and enables named reviewer access.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action(async () => {
                        const r = await api("/auth", {
                          action: "login",
                          name: authName,
                          password,
                        });
                        setConfig({ ...config, user: r.user });
                        setPassword("");
                        setMessage(
                          "Signed in. Saving remains an explicit action.",
                        );
                        setWorkspaces(await api("/workspaces"));
                        setTemplates(await api("/templates"));
                      });
                    }}
                  >
                    <label>
                      Username
                      <input
                        autoComplete="username"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        minLength={3}
                        maxLength={40}
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={12}
                        maxLength={200}
                      />
                    </label>
                    <div className="button-row">
                      <button className="button primary" disabled={busy}>
                        Sign in
                      </button>
                      <button
                        className="button"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            const r = await api("/auth", {
                              action: "register",
                              name: authName,
                              password,
                            });
                            setConfig({ ...config, user: r.user });
                            setPassword("");
                            setMessage(
                              "Account created. You can now save a private workspace.",
                            );
                          })
                        }
                      >
                        Create account
                      </button>
                    </div>
                  </form>
                </section>
              ) : (
                <>
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Your private workspaces</h2>
                      <button
                        className="text-button"
                        onClick={() => void refreshWorkspace()}
                      >
                        Refresh ↻
                      </button>
                    </div>
                    <button
                      className="button primary"
                      disabled={busy || !editable}
                      onClick={() => void saveWorkspace()}
                    >
                      {saved
                        ? "Save current workspace"
                        : "Save as a private workspace"}
                    </button>
                    {workspaces.map((w) => (
                      <div className="history-row" key={w.id}>
                        <div>
                          <strong>{w.title}</strong>
                          <p>
                            {w.role} · updated{" "}
                            {new Date(w.updated).toLocaleString()}
                          </p>
                        </div>
                        <button
                          className="button"
                          onClick={() =>
                            setModal({ type: "open", workspace: w })
                          }
                        >
                          Open
                        </button>
                        {w.role === "owner" && (
                          <button
                            className="icon-button"
                            aria-label={`Delete ${w.title}`}
                            onClick={() =>
                              setModal({ type: "delete", workspace: w })
                            }
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {!workspaces.length && (
                      <p className="muted">No saved workspaces yet.</p>
                    )}
                    <button
                      className="text-button"
                      onClick={() =>
                        void action(async () => {
                          await api("/logout", {});
                          setConfig({ ...config, user: null });
                          setSaved(null);
                          setWorkspaces([]);
                          setTemplates([]);
                          setMessage(
                            "Signed out. Your current session copy remains until cleared.",
                          );
                        })
                      }
                    >
                      Sign out
                    </button>
                  </section>
                  <section className="panel">
                    <h2>Invite a named reviewer</h2>
                    <p>
                      Users register on this server first. Reviewers can record
                      decisions; editors can save source changes. Only owners
                      manage access.
                    </p>
                    <label>
                      Username
                      <input
                        value={shareName}
                        onChange={(e) => setShareName(e.target.value)}
                      />
                    </label>
                    <label>
                      Access
                      <select
                        value={shareRole}
                        onChange={(e) => setShareRole(e.target.value)}
                      >
                        <option value="reviewer">
                          Reviewer — decisions only
                        </option>
                        <option value="editor">
                          Editor — sources and reviews
                        </option>
                        <option value="remove">Remove access</option>
                      </select>
                    </label>
                    <button
                      className="button"
                      disabled={!saved || saved.role !== "owner" || busy}
                      onClick={() =>
                        void action(async () => {
                          await api(`/workspaces/${saved.id}/access`, {
                            name: shareName,
                            role: shareRole,
                          });
                          setMessage(
                            "Workspace access updated. No message was sent.",
                          );
                        })
                      }
                    >
                      Update access
                    </button>
                    {!saved && (
                      <p className="muted">Save your workspace first.</p>
                    )}
                  </section>
                  <section className="panel">
                    <h2>Reusable event templates</h2>
                    <p>
                      Templates store the current source documents and coverage
                      settings in your private account.
                    </p>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          await api("/templates", { title, documents });
                          setTemplates(await api("/templates"));
                          setMessage("Private template saved.");
                        })
                      }
                    >
                      Save current sources as template
                    </button>
                    {templates.map((t) => (
                      <div className="history-row" key={t.id}>
                        <strong>{t.title}</strong>
                        <button
                          className="button"
                          onClick={() =>
                            setModal({ type: "template", template: t })
                          }
                        >
                          Use template
                        </button>
                      </div>
                    ))}
                  </section>
                </>
              )}
              <section className="panel subtle">
                <h2>Workspace boundaries</h2>
                <ul>
                  <li>No public sharing by default.</li>
                  <li>
                    Saved data remains on this server until you delete the
                    workspace.
                  </li>
                  <li>
                    AI-assisted review sends text to the configured provider.
                  </li>
                  <li>
                    Reviewer access applies to saved workspaces, not local
                    exports.
                  </li>
                  <li>
                    Use HTTPS before enabling remote access or real user
                    accounts.
                  </li>
                </ul>
                <button
                  className="text-button danger"
                  onClick={() => setModal({ type: "clear" })}
                >
                  Clear this session workspace
                </button>
              </section>
            </div>
          )}
          {tab === "export" && (
            <div className="export-grid">
              <section className="panel">
                <span className="export-art" aria-hidden="true">
                  ▤ ↗
                </span>
                <h2>A review you can trace.</h2>
                <p>
                  Source hashes, exact evidence, coverage, decisions, saved
                  scenarios, and the revision record—all in one place.
                </p>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={includeSources}
                    onChange={(e) => setIncludeSources(e.target.checked)}
                  />
                  Include full source text and drafts
                </label>
                <p className="small-note">
                  Evidence quotes are always included. Review the report before
                  sharing confidential material.
                  {stale
                    ? " Current review is stale; the export labels unchecked drafts."
                    : ""}
                </p>
                <div className="button-row">
                  <button
                    className="button primary"
                    disabled={!runs.length}
                    onClick={() =>
                      download(
                        "briefcheck-review.html",
                        htmlReport(
                          exportData({ ...workspace(), stale }, includeSources),
                        ),
                        "text/html",
                      )
                    }
                  >
                    ↓ Printable HTML report
                  </button>
                  <button
                    className="button"
                    disabled={!runs.length}
                    onClick={() =>
                      download(
                        "briefcheck-review.json",
                        JSON.stringify(
                          exportData({ ...workspace(), stale }, includeSources),
                          null,
                          2,
                        ),
                        "application/json",
                      )
                    }
                  >
                    ↓ Structured JSON
                  </button>
                </div>
              </section>
              <section className="panel">
                <h2>Authorized workspace integration</h2>
                <p>
                  Send a review report to the operator-configured destination.
                  GitHub exports are public. Destination credentials stay on the server.
                </p>
                {config.integrations.length ? (
                  <>
                    <p>{config.integrations[0]}</p>
                    <button
                      className="button"
                      disabled={!runs.length || !config.user}
                      onClick={() => setModal({ type: "webhook" })}
                    >
                      Review export to integration
                    </button>
                  </>
                ) : (
                  <div className="empty-integration">
                    <strong>No destination connected</strong>
                    <p>
                      Configure BRIEFCHECK_WEBHOOK_URL and an optional token on
                      the server. JSON and HTML exports work without an
                      integration.
                    </p>
                  </div>
                )}
                <h3>Participant clarification sheet</h3>
                <p>
                  Only wording explicitly approved by an organizer is included.
                </p>
                <button
                  className="button"
                  disabled={!clarifications.length}
                  onClick={() =>
                    download(
                      "briefcheck-clarifications.json",
                      JSON.stringify(
                        {
                          event: title,
                          clarifications,
                          notice:
                            "Organizer-approved wording; refer to its cited source review.",
                        },
                        null,
                        2,
                      ),
                      "application/json",
                    )
                  }
                >
                  ↓ Approved clarifications
                </button>
              </section>
            </div>
          )}
          <footer>
            <span>
              briefcheck<span className="brand-dot">.</span>
            </span>
            <p>Evidence → example → decision → retest</p>
            <span>Independent organizer tool</span>
          </footer>
        </main>
      </div>
      {modal && (
        <Dialog
          title={
            modal.type === "evidence"
              ? "Original source evidence"
              : modal.type === "edit"
                ? "Review a local draft"
                : modal.type === "import"
                  ? "Import source material"
                  : modal.type === "extraction"
                    ? "Correct an interpretation"
                    : modal.type === "predicate"
                      ? "Test a requirement"
                      : modal.type === "clarification"
                        ? "Approve a clarification"
                        : modal.type === "about"
                          ? "Built for clearer instructions"
                          : "Confirm workspace action"
          }
          onClose={() => setModal(null)}
        >
          {modal.type === "evidence" && (
            <>
              <Badge tone="green">Exact source span verified</Badge>
              <p>
                {modal.document.title} · {modal.document.role}
              </p>
              <p className="mono small-note">
                {modal.document.versionId}
                <br />
                SHA-256 {modal.document.contentHash}
              </p>
              <pre className="source-text">
                {modal.document.text.slice(0, modal.evidence.start)}
                <mark>
                  {modal.document.text.slice(
                    modal.evidence.start,
                    modal.evidence.end,
                  )}
                </mark>
                {modal.document.text.slice(modal.evidence.end)}
              </pre>
              <p>
                Offsets {modal.evidence.start}–{modal.evidence.end} in this
                immutable source version.
              </p>
            </>
          )}
          {modal.type === "edit" && (
            <>
              <p>
                <strong>{modal.document.title}</strong> · Changes affect this
                local draft only.
              </p>
              <div className="edit-grid">
                <div>
                  <label>Original source</label>
                  <pre className="source-text">{modal.document.text}</pre>
                </div>
                <label>
                  Editable draft
                  <textarea
                    rows={14}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                </label>
              </div>
              {related.some(
                (r: Data) =>
                  r.documentId === modal.document.id && r.topic === "duration",
              ) && (
                <div className="suggestion-box">
                  <label>
                    Organizer’s boundary choice
                    <select
                      value={policy}
                      onChange={(e) => setPolicy(e.target.value)}
                    >
                      <option value="">Choose the intended policy…</option>
                      <option value="include">
                        Include the exact boundary
                      </option>
                      <option value="exclude">
                        Exclude the exact boundary
                      </option>
                      <option value="discourage">
                        Recommend staying below it
                      </option>
                    </select>
                  </label>
                  <button
                    className="button"
                    disabled={!policy}
                    onClick={applySuggestion}
                  >
                    Apply suggested wording
                  </button>
                  <p>
                    This changes the selected duration passage and may alter
                    policy meaning. Review before saving.
                  </p>
                </div>
              )}
              <label>
                Reason for this edit
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain the organizer’s intended clarification"
                />
              </label>
              <div className="button-row">
                <button className="button primary" onClick={saveDraft}>
                  Save draft revision
                </button>
                <button className="button" onClick={() => setModal(null)}>
                  Cancel
                </button>
              </div>
              <h4>Related references in supplied sources</h4>
              {current?.requirements
                .filter(
                  (r: Data) =>
                    r.documentId !== modal.document.id &&
                    related.some((x: Data) => x.topic === r.topic),
                )
                .map((r: Data) => (
                  <blockquote key={r.id}>{r.evidence.quote}</blockquote>
                ))}
            </>
          )}
          {modal.type === "import" && (
            <>
              <p>
                Import only material you are authorized to use. URLs must be
                public HTTPS pages. PDFs need an extractable text layer.
              </p>
              <label>
                Public page URL
                <input
                  type="url"
                  value={importURL}
                  onChange={(e) => setImportURL(e.target.value)}
                />
              </label>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void importSource("url")}
              >
                Fetch and inspect page
              </button>
              <hr />
              <label>
                Text PDF · up to 2 MB, 30 pages
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importSource("pdf", file);
                  }}
                />
              </label>
              <p className="small-note">
                Imports replace this card’s text. Other sources and past review
                snapshots remain intact.
              </p>
            </>
          )}
          {modal.type === "extraction" && (
            <>
              <blockquote>{modal.requirement.evidence.quote}</blockquote>
              <p>
                Correct the normalized scope, modality, item set, or restricted predicate.
                The source quote stays immutable. Unsupported fields are
                rejected.
              </p>
              <label>
                Interpretation JSON
                <textarea
                  className="mono"
                  rows={10}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </label>
              <label>
                Reason
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button
                className="button primary"
                onClick={() => {
                  try {
                    const patch = JSON.parse(draft);
                    if (
                      !reason.trim() ||
                      ![
                        "required",
                        "recommended",
                        "permitted",
                        "descriptive",
                      ].includes(patch.modality) ||
                      typeof patch.scope !== "string" ||
                      !patch.scope.trim() ||
                      (patch.predicate !== null &&
                        !validatePredicate(patch.predicate))
                    )
                      throw new Error(
                        "Provide a reason, scope, valid modality and restricted predicate.",
                      );
                    if (
                      ["duration", "team size", "deadline"].includes(
                        modal.requirement.topic,
                      ) &&
                      !patch.predicate
                    )
                      throw new Error(
                        "A numeric requirement needs a supported predicate.",
                      );
                    if (!Array.isArray(patch.items) || patch.items.length > 30 || patch.items.some((x:unknown)=>typeof x!=='string'||!x.trim()||x.length>200) || (['criteria','deliverables'].includes(modal.requirement.topic)&&patch.items.length===0)) throw new Error('Provide the explicit nonempty item set for criteria or deliverables; use an array of short strings.');
                    const reqs = current.requirements.map((r: Data) =>
                      r.id === modal.requirement.id
                        ? {
                            ...r,
                            scope: patch.scope,
                            modality: patch.modality,
                            predicate: patch.predicate,
                            items: patch.items,
                            status: "supported",
                            correction: {
                              reason,
                              at: new Date().toISOString(),
                            },
                          }
                        : r,
                    );
                    const next = assembleReview(
                      current.versions,
                      {
                        requirements: reqs,
                        errors: current.errors.filter(
                          (e: Data) =>
                            e.evidence?.quote !==
                            modal.requirement.evidence.quote,
                        ),
                      },
                      current.mode,
                    );
                    carryReviewState(current, next);
                    setRuns((rs) => [
                      ...rs,
                      {
                        ...next,
                        model: current.model,
                        promptVersion: current.promptVersion,
                        interpretationCorrection: reason,
                      },
                    ]);
                    setHistorical(null);
                    setModal(null);
                    setMessage(
                      "Organizer interpretation saved as a new review. Inspect findings and rerun scenarios.",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Save interpretation as new review
              </button>
            </>
          )}
          {modal.type === "predicate" && (
            <>
              <blockquote>{modal.requirement.evidence.quote}</blockquote>
              <p>
                Supply only the facts needed by this predicate. Missing facts
                return “Cannot determine.” Supported fields: duration (seconds),
                team size (whole people), deadline (Unix milliseconds), track
                and deliverable.
              </p>
              <pre>{JSON.stringify(modal.requirement.predicate, null, 2)}</pre>
              <label>
                Scenario facts (JSON)
                <textarea
                  className="mono"
                  rows={6}
                  value={testFacts}
                  onChange={(e) => setTestFacts(e.target.value)}
                />
              </label>
              <button
                className="button primary"
                onClick={() => {
                  try {
                    const facts = JSON.parse(testFacts);
                    if (
                      !facts ||
                      Array.isArray(facts) ||
                      typeof facts !== "object" ||
                      Object.keys(facts).some(
                        (k) =>
                          ![
                            "duration",
                            "team size",
                            "deadline",
                            "track",
                            "deliverable",
                          ].includes(k),
                      )
                    )
                      throw new Error(
                        "Provide an object containing supported fact fields.",
                      );
                    for (const key of ["duration", "team size", "deadline"])
                      if (
                        key in facts &&
                        (!Number.isFinite(facts[key]) ||
                          (key !== "deadline" && facts[key] < 0) ||
                          (key === "team size" &&
                            !Number.isInteger(facts[key])))
                      )
                        throw new Error(
                          "Numeric facts must be valid; team size must be a whole number.",
                        );
                    const r = modal.requirement;
                    const result = outcome(r, facts);
                    setRuns((rs) =>
                      rs.map((x) =>
                        x.id === current.id
                          ? {
                              ...x,
                              scenarios: [
                                ...x.scenarios,
                                {
                                  id: crypto.randomUUID(),
                                  runId: x.id,
                                  topic: r.topic,
                                  scope: r.scope,
                                  facts,
                                  at: new Date().toISOString(),
                                  evaluatorVersion: x.engineVersion,
                                  assumptions: r.assumptions,
                                  predicates: [
                                    {
                                      id: r.id,
                                      predicate: r.predicate,
                                            items: r.items,
                                      versionId: r.evidence.versionId,
                                    },
                                  ],
                                  outcomes: [
                                    {
                                      requirementId: r.id,
                                      versionId: r.evidence.versionId,
                                      result,
                                    },
                                  ],
                                },
                              ],
                            }
                          : x,
                      ),
                    );
                    setMessage(result + " — scenario saved.");
                    setModal(null);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Evaluate & save scenario
              </button>
            </>
          )}
          {modal.type === "clarification" && (
            <>
              <p>
                Write the final wording yourself. Approval records an organizer
                decision tied to this source review.
              </p>
              <label>
                Approved clarification
                <textarea
                  rows={5}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </label>
              <button
                className="button primary"
                disabled={!draft.trim() || !!historical}
                onClick={() => {
                  setClarifications((cs) => [
                    ...cs,
                    {
                      id: crypto.randomUUID(),
                      text: draft,
                      runId: run.id,
                      findingId: modal.findingId,
                      sourceVersions: run.versions.map(
                        (v: Data) => v.versionId,
                      ),
                      at: new Date().toISOString(),
                      approvedBy: config.user?.name || "Session organizer",
                    },
                  ]);
                  setModal(null);
                  setMessage(
                    "Clarification recorded. Export it from the review export screen.",
                  );
                }}
              >
                Approve this wording
              </button>
            </>
          )}
          {modal.type === "about" && (
            <>
              <p>
                BriefCheck compares supplied event instructions and makes
                boundary differences testable. It is an independent tool, not an
                official Devpost product.
              </p>
              <p>
                Deterministic mode supports explicit English patterns. AI mode
                adds model extraction, for English text and supported
                conditions, when a provider is configured. Neither mode
                certifies eligibility or legal compliance.
              </p>
              <p>
                Current session data is not durable until saved or exported. No
                pilot or production accuracy claim is made.
              </p>
            </>
          )}
          {[
            "replace",
            "clear",
            "remove",
            "open",
            "delete",
            "template",
            "webhook",
          ].includes(modal.type) && (
            <>
              <p>
                {modal.type === "replace"
                  ? "Replace this session with sample materials? Export any current work you want to keep first."
                  : modal.type === "clear"
                    ? "Clear the current in-memory workspace? Saved server workspaces are unaffected."
                    : modal.type === "remove"
                      ? `Remove ${modal.document.title || "this source"}? Previous snapshots remain in review history, and current results become stale.`
                      : modal.type === "delete"
                        ? `Permanently delete the saved workspace “${modal.workspace.title}” and its shared access? Your current session copy is unaffected.`
                        : modal.type === "webhook"
                          ? "Send the report, including evidence quotes and your selected source-text option, to the configured external destination?"
                          : modal.type === "template"
                            ? "Start a new session from this template? Export your current session first if needed."
                            : "Open this saved workspace and replace your session copy? Export unsaved changes first."}
              </p>
              <div className="button-row">
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => {
                    if (modal.type === "replace") replaceSample(modal.kind);
                    else if (modal.type === "clear") {
                      setDocuments([blankDocument(), blankDocument()]);
                      setRuns([]);
                      setRevisions([]);
                      setClarifications([]);
                      setSaved(null);
                      setTitle("Untitled event");
                      setModal(null);
                      setTab("materials");
                    } else if (modal.type === "remove") {
                      setDocuments((ds) =>
                        ds.filter((d) => d.id !== modal.document.id),
                      );
                      setModal(null);
                    } else if (modal.type === "open")
                      void openWorkspace(modal.workspace.id);
                    else if (modal.type === "delete")
                      void action(async () => {
                        await api(
                          `/workspaces/${modal.workspace.id}`,
                          undefined,
                          "DELETE",
                        );
                        setWorkspaces(await api("/workspaces"));
                        if (saved?.id === modal.workspace.id) setSaved(null);
                        setModal(null);
                        setMessage("Saved workspace deleted.");
                      });
                    else if (modal.type === "template") {
                      setDocuments(
                        modal.template.data.map((d: Data) => ({
                          ...d,
                          id: crypto.randomUUID(),
                        })),
                      );
                      setTitle(modal.template.title);
                      setRuns([]);
                      setRevisions([]);
                      setClarifications([]);
                      setSaved(null);
                      setHistorical(null);
                      setModal(null);
                      setTab("materials");
                    } else
                      void action(async () => {
                        await api("/integrations/export", {
                          confirm: true,
                          report: exportData(
                            { ...workspace(), stale },
                            includeSources,
                          ),
                        });
                        setModal(null);
                        setMessage(
                          "Review report sent to the configured integration.",
                        );
                      });
                  }}
                >
                  Confirm{" "}
                  {modal.type === "delete"
                    ? "deletion"
                    : modal.type === "webhook"
                      ? "export"
                      : ""}
                </button>
                <button className="button" onClick={() => setModal(null)}>
                  Cancel
                </button>
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="dialog-error">
              {error}
            </p>
          )}
        </Dialog>
      )}
    </div>
  );
}
function Empty({
  title,
  text,
  onClick,
  action,
}: {
  title: string;
  text: string;
  onClick: () => void;
  action: string;
}) {
  return (
    <section className="empty-state panel">
      <span aria-hidden="true">◈</span>
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="button primary" onClick={onClick}>
        {action}
      </button>
    </section>
  );
}
function predicateLabel(p: Data): string {
  if (!p) return "Unresolved";
  if (p.args)
    return p.args.map(predicateLabel).join(p.op === "and" ? " AND " : " OR ");
  if (p.op === "in") return `${p.field} ∈ ${p.values.join(", ")}`;
  return `${p.field} ${{ lt: "<", lte: "≤", eq: "=", gte: "≥", gt: ">" }[p.op as "lt"]} ${p.field === "deadline" ? new Date(p.value).toISOString() : p.value}`;
}

function DependencyMap({ review }: { review: Data }) {
  const docs = review.versions,
    topics = TOPICS.filter((t) =>
      review.requirements.some((r: Data) => r.topic === t),
    );
  const height = Math.max(docs.length, topics.length) * 66 + 25;
  return (
    <div className="dependency-map">
      <svg
        viewBox={`0 0 720 ${height}`}
        role="img"
        aria-label="Dependency graph linking supplied source documents to extracted requirement topics"
      >
        {docs.flatMap((d: Data, i: number) =>
          topics.map((topic, j) =>
            review.requirements.some(
              (r: Data) => r.documentId === d.id && r.topic === topic,
            ) ? (
              <path
                key={d.id + topic}
                d={`M 265 ${i * 66 + 32} C 355 ${i * 66 + 32},365 ${j * 66 + 32},455 ${j * 66 + 32}`}
                fill="none"
                stroke="#b5c9b0"
                strokeWidth="1.5"
              />
            ) : null,
          ),
        )}
        {docs.map((d: Data, i: number) => (
          <g key={d.id}>
            <rect
              x="2"
              y={i * 66 + 10}
              width="263"
              height="44"
              rx="7"
              fill="#f4f7ef"
              stroke="#d8e1d0"
            />
            <text x="15" y={i * 66 + 37} fill="#3d5c34" fontSize="13">
              {d.title.length > 30 ? d.title.slice(0, 29) + "…" : d.title}
            </text>
          </g>
        ))}
        {topics.map((topic, j) => (
          <g key={topic}>
            <rect
              x="455"
              y={j * 66 + 10}
              width="260"
              height="44"
              rx="7"
              fill="#eaf1e5"
              stroke="#d8e1d0"
            />
            <text x="470" y={j * 66 + 37} fill="#3d5c34" fontSize="13">
              {topic} ·{" "}
              {
                review.requirements.filter((r: Data) => r.topic === topic)
                  .length
              }{" "}
              references
            </text>
          </g>
        ))}
      </svg>
      <p className="small-note">
        Edges represent extracted references only. No unscanned pages are
        included.
      </p>
    </div>
  );
}
