import { outcome } from "./engine.mjs";
export function carryReviewState(previous, next) {
  if (!previous) return next;
  for (const finding of next.findings) {
    const old = previous.findings.find((f) => f.id === finding.id),
      decision = previous.decisions?.[finding.id];
    if (old && decision)
      next.decisions[finding.id] = {
        ...decision,
        needsReview: old.evidence.some(
          (e) => !next.versions.some((v) => v.versionId === e.versionId),
        ),
      };
  }
  next.scenarios = (previous.scenarios || []).map((s) => {
    const priorIds = s.predicates.map((p) => p.id),
      prior = previous.requirements.filter((r) => priorIds.includes(r.id));
    const candidates = next.requirements.filter((r) =>
      prior.some(
        (p) =>
          p.documentId === r.documentId &&
          p.topic === r.topic &&
          p.scope === r.scope,
      ),
    );
    const missing = prior.filter(
      (p) =>
        !candidates.some(
          (r) =>
            r.documentId === p.documentId &&
            r.topic === p.topic &&
            r.scope === p.scope,
        ),
    );
    const stale =
      missing.length > 0 ||
      candidates.some((r) => r.status !== "supported") ||
      next.errors.some((e) => !e.topic || e.topic === s.topic);
    return {
      ...s,
      id: crypto.randomUUID(),
      rerunOf: s.id,
      runId: next.id,
      at: new Date().toISOString(),
      stale,
      evaluatorVersion: next.engineVersion,
      predicates: candidates.map((r) => ({
        id: r.id,
        predicate: r.predicate,
        versionId: r.evidence.versionId,
      })),
      outcomes: [
        ...candidates.map((r) => ({
          requirementId: r.id,
          versionId: r.evidence.versionId,
          result: outcome(r, s.facts),
        })),
        ...missing.map((r) => ({
          requirementId: r.id,
          versionId: null,
          result: "Cannot determine: source requirement no longer extracted",
        })),
      ],
    };
  });
  return next;
}
