# Verification record

Date: October 25, 2026 (America/Chicago). Environment: macOS arm64, Node 25.2.1, npm 11.6.2, installed TypeScript/Vite, existing Chromium build 1243 through Playwright. No real model credentials or external integration destination were available.

## Verified story

An organizer supplies documents → the API validates and snapshots them → supported requirements and exact evidence are returned → the browser evaluates a boundary → an organizer edits a local draft → rerun changes the relevant outcome and preserves the prior evidence → export contains the same source versions and saved facts.

| Check | Actual evidence |
|---|---|
| Unit/regression tests | 23 passing `node:test` tests: PRD T01–T14 behavior, normalization, typed Boolean predicates, import address restrictions, auth, saved scenario versioning, mocked multilingual evidence, bounded model repair, saved-workspace tampering rejection |
| Production compile | `tsc --noEmit` and `vite build` pass; production HTML and built JavaScript return HTTP 200; final API suite passes against production server |
| Browser full flow | Sample → actual review → exact evidence dialog → 180 seconds → saved scenario → suggested local edit → rerun → JSON export → undo → injected 504 failure → stale preserved draft |
| Export assertions | Two runs and one revision retained; rerun points at the new source predicates; both sources return the expected revised 180-second outcome |
| API integration | Anonymous review, account registration, private save/read, reviewer decision, forbidden source overwrite, access revocation, stale-write conflict, missing-origin rejection, unavailable-AI error, SSRF rejection, workspace deletion |
| Import integration | Real HTTPS HTML import from example.com; generated synthetic text PDF successfully parsed with page provenance; invalid PDF rejected |
| Accessibility | Axe WCAG 2 A/AA + 2.1 AA checks on source and review screens: zero violations after contrast fixes. Native labeled inputs, visible focus and modal dialogs |
| Keyboard | Keyboard-only review, boundary, evidence dialog/Escape, manual draft edit, save and rerun passed |
| Mobile | Browser width 390 px; no horizontal document overflow; screenshot inspected |
| Provider boundary | Mocked output tests reject fabricated quotes and cap repair at two total calls; Spanish exact quote validates. No paid/provider requests performed |
| Privacy/staging | Project `.env`, `.data/`, `node_modules/`, build output and learner profile ignored; credential-pattern scan of intended source found no real keys |

## Evaluation

The comparison engine was frozen at SHA-256 `b31430496d16631388c8400da1b992893ddc6bb3cfb900cc171425793d87b8a5` for the held-out run. Both splits and raw results are in `evaluation/`.

- Development: 19/20 cases matched; 12 true positives, 0 false positives, 1 missed contradiction (unsupported “fewer than” wording); 24/24 emitted evidence spans valid.
- Held out, one run: 20/20 matched; 13 true positives, 0 false positives, 0 misses; 27/27 evidence spans valid. Seven legitimate/equivalent cases generated no findings.
- Dataset totals: 10 contradictions, 8 omissions, 8 ambiguities, 14 legitimate differences/equivalences.
- Important limitation: labels and fixtures were authored by the implementing agent. This is not blind independent evaluation or broad production accuracy. The structured extraction/model prompt was not evaluated live. Do not present the deterministic counts as model accuracy.

## Not verified / not performed

- Live OpenAI or gateway structured-output quality, real rate-limit responses, provider latency/cost, retention settings, multilingual accuracy or advanced natural-language condition coverage.
- An actual webhook delivery or native event-platform/repository integration. Only the generic integration implementation is present.
- Independent human labels, the simple-LLM-prompt comparison, three-to-five-organizer pilot, adoption/impact measurements or expert language review.
- Full screen-reader testing, every native-select keyboard interaction, large-scale load/security testing, HTTPS hosted accounts or multi-instance persistence.
- Public deployment, public Git repository upload, actual demo recording/upload, Devpost registration/submission, or the user's final hands-on acceptance.

Failures found during verification were repaired before recording a pass: low text contrast; stale scenario predicates after a rerun; missing saved-workspace evidence validation. Test-harness issues included browser-context setup for axe, public-page title/body expectations and native-select keyboard automation; these are not represented as passing tests before correction.

## Shipping verification update

The previously missing API key is now locally configured. Live provider testing exposed scope and timeout problems, then Hindi offset-counting failures. These failed runs are preserved. The repair uses strict canonical scope, low reasoning for the configured mini model, and server-side unique verbatim quote matching. Three research smoke cases then passed in roughly 10–12 seconds each; this does not establish general language accuracy. The user subsequently restricted the release to English only.

Independent-agent original audit: 12 cases, 9 passing / 2 failing / 1 inconclusive. Retest: 11 meet original expectations (two via explicit safe abstention), one artifact-coverage case remains inconclusive. Four delayed-write/revocation tests pass. Expanded workflow audit found decision persistence and approval invalidation issues, now repaired and independently retested. See evaluation/independent-agent.* for raw evidence.

The original 20-case held-out result remains a historical engine-1.0 result; it is not relabeled as a fresh blind evaluation of engine 1.1. User delegated personal hands-on testing to the agent. No organizer pilot or independent human validation is claimed.
