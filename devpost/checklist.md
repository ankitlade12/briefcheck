---
status: approved
mode: fast
---
# Build checklist
## Slices
- [x] **1. Evidence and executable review**
  Becomes usable: paste sources, review exact evidence and test boundaries.
  Why now: proves the kernel before expanding the workspace.
  PRD ref: Analysis; Scenarios
  Spec ref: Review Engine; Interface; Server
  Build: validated extraction, comparison, source snapshots and review interface.
  Verify (mechanical): unit and API tests, TypeScript build.
  Learner check: load synthetic example and test 180 seconds.
  Commit: feat: add evidence-backed review and scenarios
- [x] **2. Revision and audit loop**
  Becomes usable: decisions, corrections, reruns, undo, history, exports.
  Why now: completes the product's defining workflow.
  PRD ref: Corrections; Export and Reversibility
  Spec ref: Interface; Review Engine
  Build: immutable revisions, change classifications and safe reports.
  Verify (mechanical): regression and browser flow.
  Learner check: align duration wording, rerun and inspect old evidence.
  Commit: feat: add versioned correction and audit exports
- [ ] **3. Expanded workspace**
  Becomes usable: imports, persistence, roles, templates, integration and multilingual/conditional extraction.
  Why now: depends on reliable review semantics.
  PRD ref: Expanded Workspace
  Spec ref: Server; Model Boundary
  Build: implement each roadmap capability and document external dependencies.
  Verify (mechanical): security and access tests, import tests and UI checks.
  Learner check: save and reopen a workspace and inspect imported provenance.
  Commit: feat: extend organizer workspace
## Hands-on Checkpoints
- [x] User delegated hands-on testing to the agent; browser review/correction/retest flow verified. No claim that the user personally tried it.
## Final Review
- [x] Agent reviewed the expanded workflows at the user’s explicit request; independent AI audit and failures retained.
- [ ] Submission upload and final learner-written form remain outstanding.
## Code Tour and App Map
- [x] App map created.
- [x] App map and reusable boundary-testing practice offered. Experienced user requested agent-led testing; no personal learning outcome inferred.
## Revisions
- User explicitly requests full P0/P1/P2 coverage; no roadmap feature silently cut.
- User directs autonomous building from supplied PRD; ceremonial approval pauses omitted. Technical plan remains draft pending actual review, rather than fabricating approval.

- Implemented the expanded workspace code, but slice 3 remains open for live AI/integration configuration and language evaluation.
- One verified implementation checkpoint is being created for the integrated build; no earlier incremental commits are claimed.
- Verification completed: 23 unit/regression checks; browser correction/retest/export and failure recovery; API collaboration/access; live public-page and synthetic-PDF imports; source/review accessibility audit; production build.
- App map and an optional reusable boundary-testing practice are prepared. No user learning or final acceptance is inferred.

- English-only release requested; multilingual feature removed from current release scope.
- Public repository and demo preparation authorized by request to complete outstanding items.
