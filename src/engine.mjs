export const ENGINE_VERSION = "briefcheck-1.1";
export const TOPICS = [
  "duration",
  "team size",
  "deadline",
  "criteria",
  "deliverables",
];
export const ROLES = [
  "overview",
  "official rules",
  "FAQ",
  "update",
  "submission checklist",
  "other",
];
export function validateDocuments(docs) {
  if (!Array.isArray(docs) || docs.length < 2 || docs.length > 4)
    throw new Error("Add two to four documents.");
  if (new Set(docs.map((d) => d.id)).size !== docs.length)
    throw new Error("Document IDs must be unique.");
  let total = 0;
  for (const d of docs) {
    if (
      typeof d.id !== "string" ||
      !d.id ||
      typeof d.title !== "string" ||
      !d.title.trim() ||
      d.title.length > 200
    )
      throw new Error(
        "Every document needs a title (up to 200 characters) and ID.",
      );
    if (!ROLES.includes(d.role) || typeof d.text !== "string" || !d.text.trim())
      throw new Error(`Add text and a valid role for ${d.title}.`);
    if (d.url && (!/^https?:\/\//i.test(d.url) || d.url.length > 2048))
      throw new Error("Source links must be HTTP or HTTPS URLs.");
    total += d.text.length;
  }
  if (total > 40000)
    throw new Error(
      "The combined limit is 40,000 characters. Shorten the documents; nothing has been truncated.",
    );
  return total;
}
export function normalizeWithMap(text) {
  let normalized = "",
    map = [];
  for (let i = 0; i < text.length; i++) {
    map.push(i);
    if (text[i] === "\r") {
      normalized += "\n";
      if (text[i + 1] === "\n") i++;
    } else normalized += text[i];
  }
  map.push(text.length);
  return { text: normalized, offsets: map };
}
export function verifyEvidence(e, versions) {
  const d = versions.find((v) => v.versionId === e.versionId);
  return (
    !!d &&
    Number.isInteger(e.start) &&
    Number.isInteger(e.end) &&
    e.start >= 0 &&
    e.end > e.start &&
    e.end <= d.text.length &&
    d.text.slice(e.start, e.end) === e.quote
  );
}
export function validatePredicate(p, depth = 0) {
  if (!p || depth > 4 || typeof p !== "object") return false;
  if (["and", "or"].includes(p.op))
    return (
      Array.isArray(p.args) &&
      p.args.length > 0 &&
      p.args.length <= 8 &&
      p.args.every((x) => validatePredicate(x, depth + 1))
    );
  if (p.op === "in")
    return (
      ["duration", "team size", "deadline", "track", "deliverable"].includes(
        p.field,
      ) &&
      Array.isArray(p.values) &&
      p.values.length > 0 &&
      p.values.length <= 30 &&
      p.values.every((v) => typeof v === "string" || Number.isFinite(v))
    );
  return (
    ["lt", "lte", "eq", "gte", "gt"].includes(p.op) &&
    ["duration", "team size", "deadline"].includes(p.field) &&
    Number.isFinite(p.value)
  );
}
export function evaluate(p, facts) {
  if (!validatePredicate(p)) return null;
  if (p.op === "and" || p.op === "or") {
    const values = p.args.map((x) => evaluate(x, facts));
    return p.op === "and"
      ? values.includes(false)
        ? false
        : values.includes(null)
          ? null
          : true
      : values.includes(true)
        ? true
        : values.includes(null)
          ? null
          : false;
  }
  const v = facts[p.field];
  if (v === undefined || v === null) return null;
  if (p.op === "in") return p.values.includes(v);
  if (!Number.isFinite(v)) return null;
  return {
    lt: () => v < p.value,
    lte: () => v <= p.value,
    eq: () => v === p.value,
    gte: () => v >= p.value,
    gt: () => v > p.value,
  }[p.op]();
}
export function outcome(r, facts) {
  if (r.scope !== "general" && facts.track !== r.scope)
    return "Cannot determine: supply the matching track";
  if (r.status !== "supported" || !r.predicate) return "Cannot determine";
  const value = evaluate(r.predicate, facts);
  if (value === null) return "Cannot determine";
  if (r.modality === "recommended")
    return value ? "Meets recommendation" : "Outside recommendation";
  if (r.modality !== "required")
    return value
      ? "Matches this stated guidance"
      : "Outside this stated guidance";
  return value
    ? "Meets this stated requirement"
    : "Does not meet this stated requirement";
}
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
export function anchor(parts) {
  return hashString(JSON.stringify(parts));
}
const numberWord = (s) =>
  ({
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  })[s?.toLowerCase()] ?? Number(s);
const NUM =
  "(\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)(?:\\s*\\(\\d+\\))?";
const COMPARATOR =
  "(at most|no more than|up to|maximum(?: of)?|under|less than|below|at least|minimum(?: of)?|more than|over|exactly|≤|<|≥|>)";
function modality(line) {
  return /\b(should|recommend(?:ed)?|encouraged|ideally)\b/i.test(line)
    ? "recommended"
    : /\b(must|required|shall|limit|maximum|minimum|at most|at least|no more than)\b/i.test(
          line,
        )
      ? "required"
      : /\b(may|permitted|allowed)\b/i.test(line)
        ? "permitted"
        : "descriptive";
}
function scopeOf(line) {
  const match = line.match(/(?:for (?:the )?|^)([\w -]+?) track\b/i);
  return match ? match[1].trim().toLowerCase() : "general";
}
function pred(op, value, field) {
  return { op, value, field };
}
function numeric(line, topic) {
  const unit =
    topic === "duration"
      ? "(minutes?|mins?|seconds?|secs?)"
      : "(people|persons?|members?|participants?)";
  let m = line.match(
    new RegExp(COMPARATOR + "\\s*" + NUM + "\\s*" + unit, "i"),
  );
  if (m) {
    const o = m[1].toLowerCase(),
      n =
        numberWord(m[2]) *
        (topic === "duration" && /^min/i.test(m[3]) ? 60 : 1);
    const op = /^(under|less than|below|<)$/.test(o)
      ? "lt"
      : /^(at least|minimum|≥)/.test(o)
        ? "gte"
        : /^(more than|over|>)$/.test(o)
          ? "gt"
          : o === "exactly"
            ? "eq"
            : "lte";
    return pred(op, n, topic);
  }
  m = line.match(new RegExp(NUM + "\\s*[-–]\\s*" + NUM + "\\s*" + unit, "i"));
  if (m) {
    const scale = topic === "duration" && /^min/i.test(m[3]) ? 60 : 1;
    return {
      op: "and",
      args: [
        pred("gte", numberWord(m[1]) * scale, topic),
        pred("lte", numberWord(m[2]) * scale, topic),
      ],
    };
  }
  m = line.match(
    new RegExp(NUM + "\\s*" + unit + "\\s*(maximum|max|or fewer|or less)", "i"),
  );
  if (m)
    return pred(
      "lte",
      numberWord(m[1]) * (topic === "duration" && /^min/i.test(m[2]) ? 60 : 1),
      topic,
    );
  return null;
}
export function parseDeadline(line) {
  const match = line.match(
    /(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(Z|[+-]\d{2}:\d{2})/i,
  );
  if (match) {
    const iso = `${match[1]}T${match[2].padStart(2, "0")}:${match[3]}:${match[4] || "00"}${match[5]}`;
    const value = Date.parse(iso);
    const [year, month, day] = match[1].split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isFinite(value) &&
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day &&
      +match[2] < 24 &&
      +match[3] < 60 &&
      +(match[4] || 0) < 60
      ? value
      : null;
  }
  const m = line.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\s+(?:at\s+|@\s*)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\s+(UTC|GMT|EDT|EST|CDT|CST|MDT|MST|PDT|PST)\b/i,
  );
  if (!m) return null;
  const month = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].indexOf(m[1].toLowerCase());
  const hour = (+m[4] % 12) + (/^p/i.test(m[6]) ? 12 : 0),
    minute = +(m[5] || 0);
  if (+m[4] < 1 || +m[4] > 12 || minute > 59 || +m[2] < 1 || +m[2] > 31)
    return null;
  const offset = {
    UTC: 0,
    GMT: 0,
    EDT: -4,
    EST: -5,
    CDT: -5,
    CST: -6,
    MDT: -6,
    MST: -7,
    PDT: -7,
    PST: -8,
  }[m[7].toUpperCase()];
  const date = new Date(Date.UTC(+m[3], month, +m[2], hour, minute));
  if (date.getUTCMonth() !== month) return null;
  return +date - offset * 3600000;
}
export function extract(versions) {
  const requirements = [],
    errors = [];
  for (const d of versions) {
    const lines = [...d.text.matchAll(/[^\r\n]+/g)];
    let rubric = false;
    for (const lineMatch of lines) {
      const line = lineMatch[0],
        trimmed = line.trim();
      if (!trimmed) continue;
      const start = lineMatch.index,
        end = start + line.length;
      const evidence = {
        versionId: d.versionId,
        start,
        end,
        quote: line,
        validation: "verified",
      };
      const scope = scopeOf(line),
        mod = modality(line);
      const add = (
        topic,
        predicate = null,
        items = [],
        status = "supported",
        assumptions = [],
      ) =>
        requirements.push({
          id: anchor([d.id, topic, scope, line]),
          documentId: d.id,
          topic,
          scope,
          modality: mod,
          predicate,
          items,
          status,
          assumptions,
          evidence,
          conditions: [],
          exceptions: [],
        });
      if (
        /^(?:#+\s*)?(?:judging\s+)?(?:criteria|rubric)\s*:?\s*$/i.test(trimmed)
      ) {
        rubric = true;
        continue;
      }
      if (rubric && !/^(?:[-*•]|\d+[.)])\s/.test(trimmed)) rubric = false;
      if (rubric || /(?:judging criteria|rubric|criteria)\s*:/i.test(line)) {
        const content = rubric
          ? trimmed.replace(/^(?:[-*•]|\d+[.)])\s*/, "")
          : line.slice(line.indexOf(":") + 1);
        const items = content
          .split(/[,;|]/)
          .map((x) => x.trim().replace(/\.$/, "").toLowerCase())
          .filter(Boolean);
        if (items.length) add("criteria", null, items);
        continue;
      }
      let topic =
        /\b(videos?|demo|duration|recording)\b/i.test(line) &&
        /\b(minutes?|seconds?|mins?|secs?)\b/i.test(line)
          ? "duration"
          : /\b(team|teams|members)\b/i.test(line) &&
              /\b(people|persons?|members?|participants?)\b/i.test(line)
            ? "team size"
            : /\b(deadline|submissions? (?:close|due)|submit by)\b/i.test(line)
              ? "deadline"
              : null;
      if (topic) {
        const conditional = /\b(pitch|trailer|teaser)\b/i.test(line) ||
          /\b(unless|except|otherwise|if|only when|depending|not)\b/i.test(
            line,
          ) ||
          (
            line.match(
              /\b(?:minutes?|seconds?|people|members?|participants?)\b/gi,
            ) || []
          ).length > 1;
        const value = topic === "deadline" ? parseDeadline(line) : null;
        const p =
          topic === "deadline"
            ? value === null
              ? null
              : pred("lte", value, topic)
            : numeric(line, topic);
        const status = !p || conditional ? "unresolved" : "supported";
        add(
          topic,
          status === "supported" ? p : null,
          [],
          status,
          status === "unresolved"
            ? [
                "The local parser cannot safely interpret this wording, condition, or time zone. Correct the extraction or use AI-assisted review.",
              ]
            : [
                "Only this passage and the explicitly selected track are tested.",
              ],
        );
        if (status === "unresolved")
          errors.push({
            documentId: d.id,
            topic,
            message: `Needs interpretation: ${trimmed}`,
            evidence,
          });
      }
      if (
        /\b(must|required|shall)\b/i.test(line) &&
        /\b(submit|include|provide|upload)\b/i.test(line)
      ) {
        const items = [];
        if (
          /\b(?:github|gitlab|bitbucket|code repository|source code|public repository)\b/i.test(
            line,
          )
        )
          items.push("code repository");
        if (/\b(?:video|recording)\b/i.test(line)) items.push("demo video");
        if (/\b(?:description|write.up)\b/i.test(line))
          items.push("project description");
        if (/\b(?:scope\.md|prd\.md|spec\.md|planning documents)\b/i.test(line))
          items.push("planning documents");
        if (items.length && !/\b(not|unless|except)\b/i.test(line)) add("deliverables", null, items);
      }
      const artifact = /\b(videos?|recording|slide deck|repository|source code|description|write.up|planning documents)\b/i.test(line);
      const instruction = /\b(required|must|shall|may|optional|not required)\b/i.test(line);
      if (artifact && instruction && !topic && !requirements.some(r => r.documentId === d.id && r.evidence.start === start && r.topic === 'deliverables')) {
        add('deliverables', null, [], 'unresolved', ['This deliverable wording needs organizer or model interpretation; no mandatory requirement was inferred.']);
        errors.push({documentId:d.id,topic:'deliverables',message:`Needs deliverable interpretation: ${trimmed}`,evidence});
      }
    }
  }
  return { requirements, errors };
}
export function boundaries(p) {
  if (!p) return [];
  if (p.args) return p.args.flatMap(boundaries);
  return Number.isFinite(p.value) ? [p.value] : [];
}
export function scenarioValues(reqs, topic) {
  const delta = topic === "deadline" ? 1000 : 1;
  return [
    ...new Set(
      reqs.flatMap((r) =>
        boundaries(r.predicate).flatMap((b) => [b - delta, b, b + delta]),
      ),
    ),
  ]
    .filter((v) => topic === "deadline" || v >= 0)
    .sort((a, b) => a - b);
}
export function compare(versions, requirements) {
  const findings = [];
  const add = (type, topic, reqs, reason, extra = {}) => {
    const ids = [...new Set(reqs.map((r) => r.documentId))].sort();
    const scope = reqs[0]?.scope || "general";
    const key = anchor([type, topic, scope, ids, extra.missing || []]);
    findings.push({
      id: key,
      type,
      topic,
      scope,
      priority:
        topic === "deadline" || type === "contradiction" ? "High" : "Review",
      reason,
      requirementIds: reqs.map((r) => r.id),
      evidence: reqs.map((r) => r.evidence),
      status: "open",
      ...extra,
    });
  };
  for (const topic of ["duration", "team size", "deadline"]) {
    const reqs = requirements.filter(
      (r) =>
        r.topic === topic &&
        r.status === "supported" &&
        validatePredicate(r.predicate),
    );
    for (let i = 0; i < reqs.length; i++)
      for (let j = i + 1; j < reqs.length; j++) {
        const a = reqs[i],
          b = reqs[j];
        if (a.documentId === b.documentId || a.scope !== b.scope) continue;
        const values = scenarioValues([a, b], topic);
        const differing = values.filter((v) => {
          const x = evaluate(a.predicate, { [topic]: v, track: a.scope }),
            y = evaluate(b.predicate, { [topic]: v, track: b.scope });
          return x !== null && y !== null && x !== y;
        });
        if (!differing.length) continue;
        const overlap = values.some(
          (v) =>
            evaluate(a.predicate, { [topic]: v, track: a.scope }) &&
            evaluate(b.predicate, { [topic]: v, track: b.scope }),
        );
        const hard =
          !overlap && a.modality === "required" && b.modality === "required";
        add(
          hard ? "contradiction" : "ambiguity",
          topic,
          [a, b],
          hard
            ? "These explicit requirements cannot both hold for the tested scope."
            : topic === "deadline"
              ? "The supplied deadlines normalize to different instants. An organizer must choose the intended deadline."
              : `The passages give different guidance at a ${topic} boundary. ${a.modality === "recommended" || b.modality === "recommended" ? "One passage is advisory; this is not a disqualification verdict." : "The boundary needs an organizer decision."}`,
          { witness: differing[0] },
        );
      }
  }
  for (const topic of ["criteria", "deliverables"]) {
    const grouped = versions.map((d) => ({
      d,
      reqs: requirements.filter(
        (r) =>
          r.documentId === d.id &&
          r.topic === topic &&
          r.status === "supported" &&
          r.scope === "general",
      ),
    }));
    for (const target of grouped) {
      if (!target.d.coverage?.[topic]) continue;
      const targetItems = new Set(target.reqs.flatMap((r) => r.items));
      for (const reference of grouped) {
        if (reference.d.id === target.d.id || !reference.d.coverage?.[topic])
          continue;
        const missing = [...new Set(reference.reqs.flatMap((r) => r.items))]
          .filter((v) => !targetItems.has(v))
          .sort();
        if (!missing.length) continue;
        const targetEvidence = target.reqs.length
          ? target.reqs
          : [
              {
                documentId: target.d.id,
                id: `inspection-${target.d.id}-${topic}`,
                scope: "general",
                evidence: {
                  versionId: target.d.versionId,
                  start: 0,
                  end: target.d.text.length,
                  quote: target.d.text,
                  validation: "verified",
                  section: "Entire supplied document inspected",
                },
              },
            ];
        add(
          "omission",
          topic,
          [
            ...reference.reqs.filter((r) =>
              r.items.some((x) => missing.includes(x)),
            ),
            ...targetEvidence,
          ],
          `${target.d.title} is marked as complete for ${topic}, but does not list: ${missing.join(", ")}. This is an omission in supplied material, not a mutually incompatible rule.`,
          { missing, targetDocumentId: target.d.id },
        );
      }
    }
  }
  return [...new Map(findings.map((f) => [f.id, f])).values()].sort(
    (a, b) =>
      (a.priority === "High" ? -1 : 1) - (b.priority === "High" ? -1 : 1),
  );
}
export function assembleReview(versions, extraction, mode = "deterministic") {
  const errors = [...extraction.errors];
  const requirements = extraction.requirements.filter((r) => {
    if (!verifyEvidence(r.evidence, versions)) {
      errors.push({
        topic: r.topic,
        message:
          "Unsupported extraction: evidence does not match the immutable source.",
      });
      return false;
    }
    if (
      r.status === "supported" &&
      r.predicate &&
      !validatePredicate(r.predicate)
    ) {
      errors.push({
        topic: r.topic,
        message: "Unsupported predicate rejected.",
      });
      return false;
    }
    return true;
  });
  const findings = compare(versions, requirements).filter((f) =>
    f.evidence.every((e) => verifyEvidence(e, versions)),
  );
  const coverage = versions.map((d) => ({
    documentId: d.id,
    title: d.title,
    topics: TOPICS.map((topic) => ({
      topic,
      extracted: requirements.filter(
        (r) =>
          r.documentId === d.id &&
          r.topic === topic &&
          r.status === "supported",
      ).length,
      unresolved: requirements.filter(
        (r) =>
          r.documentId === d.id &&
          r.topic === topic &&
          r.status !== "supported",
      ).length,
    })),
  }));
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: errors.length ? "partial" : "ready",
    mode,
    engineVersion: ENGINE_VERSION,
    versions,
    requirements,
    findings,
    errors,
    coverage,
    limitations: [
      "Only supplied documents were inspected; no eligibility or legal verdict.",
      "Source verification confirms the quote, not the interpretation.",
      mode === "deterministic"
        ? "Local parser supports explicit English patterns only. Other wording and unextracted content are unreviewed."
        : "AI interpretations require organizer review; unsupported conditions remain unresolved.",
    ],
    scenarios: [],
    decisions: {},
  };
}
export function diffReviews(before, after) {
  if (!before) return [];
  return [
    ...before.findings.map((f) => {
      const current = after.findings.find((x) => x.id === f.id);
      const related = before.requirements.filter((r) =>
        f.requirementIds.includes(r.id),
      );
      const complete =
        after.status !== "failed" &&
        related.every((r) =>
          after.requirements.some(
            (n) =>
              n.documentId === r.documentId &&
              n.topic === r.topic &&
              n.scope === r.scope &&
              n.status === "supported",
          ),
        ) &&
        !after.errors.some((e) => !e.topic || e.topic === f.topic);
      const sourcesChanged = f.evidence.some(
        (e) => !after.versions.some((v) => v.versionId === e.versionId),
      );
      return {
        finding: f,
        state: current ? "unchanged" : complete ? "resolved" : "unresolved",
        needsDecisionReview: sourcesChanged,
      };
    }),
    ...after.findings
      .filter((f) => !before.findings.some((b) => b.id === f.id))
      .map((f) => ({ finding: f, state: "new", needsDecisionReview: false })),
  ];
}
export function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
