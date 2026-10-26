import { escapeHTML as h } from "./engine.mjs";
export function exportData(workspace, includeSources = false) {
  const data = structuredClone({
    schema_version: "1.0",
    exportedAt: new Date().toISOString(),
    ...workspace,
  });
  if (!includeSources) {
    delete data.documents;
    for (const run of data.runs || [])
      for (const v of run.versions || []) {
        delete v.text;
        delete v.normalized;
      }
    for (const rev of data.revisions || []) {
      delete rev.beforeText;
      delete rev.afterText;
    }
  }
  data.sourceTextIncluded = includeSources;
  data.privacyNote =
    "Evidence quotes and decisions are included even when full source text is excluded. Review before sharing.";
  return data;
}
export function htmlReport(data) {
  const runs = data.runs || [];
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${h(data.title)} — BriefCheck review</title><style>body{font:16px/1.6 system-ui;max-width:1000px;margin:40px auto;padding:24px;color:#182c2b}h1,h2,h3{line-height:1.2}section{border-top:1px solid #ccc;margin:30px 0;padding-top:20px}blockquote{border-left:3px solid #22756b;padding-left:18px;white-space:pre-wrap}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.meta{color:#52635e;font-size:13px}@media print{body{margin:0}section{break-inside:avoid}}</style><h1>BriefCheck / ${h(data.title)}</h1><p>Organizer review record. Not a certificate of compliance or eligibility.</p>${data.stale ? "<p><strong>UNCHECKED DRAFT CHANGES: review results below refer to earlier source versions.</strong></p>" : ""}<p class="meta">Exported ${h(data.exportedAt)} · Schema ${h(data.schema_version)}</p><p>${h(data.privacyNote)}</p>${runs.map((run) => `<section><h2>Review ${h(run.createdAt)}</h2><p>${h(run.mode)} · ${h(run.status)} · ${h(run.engineVersion)}</p><h3>Coverage and limits</h3>${run.limitations.map((x) => `<p>${h(x)}</p>`).join("")}<pre>${h(JSON.stringify(run.coverage, null, 2))}</pre><h3>Source versions</h3>${run.versions.map((v) => `<p><b>${h(v.title)}</b> / ${h(v.role)} / ${h(v.versionId)}<br>${h(v.url)}<br>SHA-256: ${h(v.contentHash)}</p>${v.text ? `<details><summary>Full source</summary><pre>${h(v.text)}</pre></details>` : ""}`).join("")}<h3>Findings</h3>${run.findings.length ? run.findings.map((f) => `<article><h3>${h(f.type)} · ${h(f.topic)}</h3><p>${h(f.reason)}</p><p>Decision: ${h(run.decisions?.[f.id]?.status || "open")} — ${h(run.decisions?.[f.id]?.reason || "")}</p>${f.evidence.map((e) => `<blockquote>${h(e.quote)}</blockquote><p class="meta">${h(e.versionId)} · offsets ${h(e.start)}–${h(e.end)}</p>`).join("")}</article>`).join("") : "<p>No findings in the completed checks.</p>"}<h3>Unresolved extractions</h3><pre>${h(JSON.stringify(run.errors, null, 2))}</pre><h3>Saved scenarios and outcomes</h3><pre>${h(JSON.stringify(run.scenarios, null, 2))}</pre></section>`).join("")}<section><h2>Revision record</h2><pre>${h(JSON.stringify(data.revisions || [], null, 2))}</pre><h2>Approved clarifications</h2><pre>${h(JSON.stringify(data.clarifications || [], null, 2))}</pre></section></html>`;
}
