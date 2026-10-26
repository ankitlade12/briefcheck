# Full PRD implementation ledger

The user's explicit scope includes P0, P1 and P2. **Implemented** means code exists; **verified** names actual evidence. No feature is treated as finished merely because a control or placeholder is visible. Source: [complete supplied PRD](source-prd.txt).

| Requirement | Implementation and verification | Remaining limit |
|---|---|---|
| FR01 workspace / add, rename, reorder, remove | Session workspace, source cards, up-arrow reorder, confirmation before remove, stale review banner; browser flow | Session is deliberately not durable until explicit save/export |
| FR02 role and coverage | Six roles; independent judging/deliverable coverage flags; incomplete-summary regression | No inferred policy precedence |
| FR03 provenance / versions / offsets / SHA-256 | Server snapshots, raw and normalized text + offset map, immutable evidence dialog; Unicode/CRLF tests | Captures supplied/imported text, not a browser screenshot of an external page |
| FR04 limits / duplicates | Client count, server 2–4/40k validation; duplicate rejection; preserved input | Duplicate exclusion is by removing/revising the source card |
| FR05 URL / PDF imports | HTTPS DNS-pinned requests, blocked private IPs, checked redirects, 2 MB cap, timeouts; text PDF ≤30 pages; page offsets and warnings; real import tests | No OCR/authenticated pages/JS rendering; extraction layout requires inspection |
| FR06 structured extraction / correction | Local parser and optional AI schema; scope/modality/predicates/items/assumptions/conditions/exceptions; manual interpretation creates a new review | Live model unverified without credentials; local parser intentionally bounded |
| FR07 compatible comparisons / semantics | Scoped numeric comparisons, disjoint contradictions, boundary ambiguities, coverage-qualified set omissions; regression and evaluation | Complex semantic overlap is not universally inferred; general-vs-track exceptions are not falsely declared conflicting |
| FR08 verified evidence | Server checks exact quote and UTF-16 offsets; invalid schema/quote/predicate fails closed; fabricated-quote test | Quote validity is separate from interpretation validity |
| FR09 priority / uncertainty | High priority for deadlines and contradictions; verified source distinct from interpretation; unresolved panel | No confidence or disqualification percentage |
| FR10 decisions | Accept/dismiss/defer; dismissal reason required; stable finding anchors; changed-source decisions marked for review; persisted reviewer identity | Local decisions must be explicitly saved/exported unless sent to an already saved run |
| FR11 minimal scenarios | Adjacent second/person/millisecond values; explicit-zone equality, missing-zone abstention | No participant eligibility simulation |
| FR12 predicate language | eq/lt/lte/gt/gte/in/and/or, bounded depth and fields; custom facts; no eval; unit tests | Subjective/legal conditions stay unresolved; model schema uses one Boolean layer, manual predicates allow depth four |
| FR13 outcome wording | Requirement vs recommendation vs descriptive guidance; unknown facts cannot pass | Outcomes apply only to a supplied predicate |
| FR14 saved tests / reruns | Facts, assumptions, evaluator, predicate versions, outcomes; rerun carries latest versions and flags missing requirements; unit + browser verification | No provider call needed for evaluation |
| FR15 targeted suggestions | Organizer explicitly includes/excludes/discourages duration boundary before applying; meaning-change warning | Conditions/exceptions require manual edit rather than unsafe automatic rewriting |
| FR16 immutable draft revision | Parent source version, before/after, changed span, reason and timestamp; old snapshots preserved | Metadata edits captured in next review; text draft editing after review uses revision editor |
| FR17 reanalysis / truthful change states | Full small-workspace rerun; resolved/unchanged/new/unresolved; missing evidence cannot resolve; timeout preserves stale prior run | No incremental dependency optimizer, as permitted by P0 contract |
| FR18 downstream effects | Related passages in draft editor, topic dependency SVG, coverage matrix, same-fact reruns | Graph contains supplied/extracted references only |
| FR19 exports | Escaped printable HTML and schema-versioned JSON with history, decisions, source hashes, coverage, tests, optional raw text; injection test | Evidence quotes always included; user must inspect confidentiality before sharing |
| FR20 reversibility | Undo records a new revision, old review inspection, local-only edits; browser test | No automatic external event publishing |
| P1 persistence / roles / history | SQLite, explicit save, login, owners/editors/reviewers, access revocation, optimistic concurrency, private templates; API tests | Local deployment only; independent security/load evaluation pending |
| P1 coverage / baseline | Coverage matrix, previous or selected baseline, dependency graph, raw evaluation download | No universal compliance score |
| P2 integrations | Configurable authenticated HTTPS report webhook; explicit send confirmation; JSON/HTML interchange | **Not live-verified:** destination and credentials not supplied. Native service-specific integrations not specified by user |
| P2 templates | Private per-user templates restore source cards into a fresh session | Stores source content; privacy disclosed |
| P2 multiple languages | Provider prompt preserves exact source-language quotes and returns English normalized values; Spanish quote/schema test | **Partial:** live provider and language-specific human evaluation pending; local parser remains English |
| P2 advanced conditions | Restricted membership and Boolean evaluator, custom fact UI, explicit unknown outcomes | **Partial:** broad conditional language quality needs live model evaluation; unsupported fields/legal clauses abstain |

## Quality, research and competition requirements

- Accessibility: native controls, dialog focus containment, focus indicators, live status, responsive layout; automated audit and keyboard/browser checks recorded in verification.md. Automated checks do not replace screen-reader testing.
- Security: input boundaries, same-origin mutation guard, bounded imports, safe HTML rendering/export, password hashing and cross-workspace permission tests. No claim of independent audit.
- Privacy: anonymous memory, explicit persistent save, private-by-default access, raw export opt-in, provider transfer disclosure, ignored credentials/database.
- Reliability: timeout/failure paths, capped repair, no invented fallback result, recorded unresolved checks. Browser simulated-provider-failure flow verified.
- Request budget: at most two model calls; 60-second timeout; concurrent/rate/request-count limits. Provider monetary cap and real cost/latency measurements pending credentials.
- Evaluation: 40 labeled cases (20 development, 20 held out at frozen engine hash), required category totals, raw counts. Agent-authored labels are a limitation. Independent human labeling and simple-prompt baseline comparison remain pending.
- Organizer pilot: **not conducted**. No adoption, support-saving, commercial demand, pricing or customer claims.
- Submission: source, license, plans, demo walkthrough and app map prepared. **Public repository, actual recorded demo, personal eligibility confirmation, learner-written submission and final hands-on sign-off remain outstanding.**

This ledger is not a declaration that every PRD ambition has been completed or validated. External dependencies and research remain explicit.
