---
status: approved
---
# BriefCheck product requirements
Product direction adopted from the supplied document at the user's express request to build it. The full, unabridged extracted source is [source-prd.txt](source-prd.txt); that document's numbered FR01–FR20, T01–T15, priorities and quality gates remain authoritative. This file is an implementation index, not a replacement or claim of completed requirements.
## Core Journey
Add labeled sources → review findings and exact passages → test a concrete case → record a decision → edit a local draft → recheck and inspect change impact → export.
## Features and Behavior
### Intake
FR01–05: event workspace, titles/roles/coverage, immutable originals, SHA-256, offsets, 2–4 sources/40k characters, duplicates, public URL/text PDF imports with provenance and safe limits.
### Analysis
FR06–10: typed extractions, scope/modality/conditions, verified evidence, explicit uncertainty and priority, accepted/dismissed/deferred decisions with reasons. Unknown interpretations do not pass.
### Scenarios
FR11–14: seconds/people/date boundaries, restricted comparisons/sets/Boolean predicates, precise advisory outcomes, saved facts and reruns tied to source versions.
### Corrections
FR15–18: organizer chooses policy before applying a suggestion, immutable revisions, changed spans/reasons, complete reanalysis, honest resolved/unchanged/new/unresolved classification, downstream references.
### Export and Reversibility
FR19–20: versioned JSON and printable HTML, source inclusion opt-in, decisions, coverage, tests, versions, undo and prior review inspection.
### Expanded Workspace
P1 and P2 from scope.md: imports, persisted workspaces and access controls, coverage/baselines, integrations, reusable templates, multilingual extraction and advanced conditions.
## Look and Feel
Light editorial workspace, restrained teal accent, spacious evidence columns, responsive stacked layout, visible focus, real buttons, status announcements and actionable errors. No generic compliance percentage.
## Acceptance
Source PRD T01–T15 plus keyboard end-to-end flow, provider failure, unsupported interpretation, 40-case evaluation with held-out split and raw counts. Do not claim evaluation success before execution.
## Product Decisions
No public sharing by default. Text stays in memory for anonymous review; persistence is explicit. AI requests disclose provider transfer. No automatic policy precedence. All simulations and synthetic samples are labeled.
