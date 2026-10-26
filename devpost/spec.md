---
status: draft
---
# BriefCheck technical specification
Implementation choices below are engineering decisions under the user's request to build; final review remains outstanding.
## How This Works, In Plain Language
The server saves an immutable description of the supplied text for each run. A bounded parser or optional model extracts requirements; exact quotes must match before comparison. Ordinary code evaluates numeric scenarios. Edits create new versions. The browser retains reviews and exports the full decision trail.
## Where It Runs and How Someone Tries It
Node 22+; npm install; npm run dev; http://127.0.0.1:5173. npm run build checks TypeScript and builds browser assets. npm test runs deterministic and server tests. Local recording is sufficient for the hackathon; public deployment is separate.
## Components
### Review Engine
Implements prd.md > Analysis and Scenarios. Shared JavaScript module with validated restricted predicates, bounded extraction, scope-aware comparison, source offsets, stable anchors and change classification. SHA-256 computed server-side. Never eval source or model text.
### Server
Implements prd.md > Intake and Expanded Workspace. Node HTTP server and Vite middleware, explicit body limits and timeouts, same-origin requests, transient reviews, optional AI SDK extraction via direct OpenAI key or environment-configured gateway model. Secrets never sent to browser. Public HTTPS/PDF imports, SQLite private workspaces, password sessions, reviewer/editor permissions, templates and an explicit report webhook are implemented.
### Interface
Implements prd.md > Core Journey, Corrections and Export and Reversibility. React/TypeScript, CSS, in-memory session, explicit save/export, original evidence dialog, revision history, boundary inputs, coverage and before/after results.
### Model Boundary
AI SDK structured output with Zod, at most one repair attempt, 60-second deadline, strict schema and quote validation. No tools or arbitrary expressions. Missing credentials disable live AI visibly, never substitute saved output. Local deterministic review remains usable. Multilingual and complex semantic extraction require a configured model and independent evaluation.
## File Structure
src/App.tsx: UI and session flow; src/styles.css: layout; src/engine.mjs: pure checks; src/samples.ts: labeled fixtures; src/export.mjs: safe reports; server/index.mjs: HTTP and imports; server/analysis.mjs: model boundary; tests/: regression and browser flow; devpost/: plan, traceability, evidence and submission checklist.
## Failure Modes
Invalid evidence cannot become a verified finding. Timeouts preserve old review and draft, marked stale. Unsupported syntax is reported. Export escapes HTML. No implicit crawling. Deleting evidence cannot mark an issue resolved.
## Dependencies
React https://react.dev/ ; Vite https://vite.dev/ ; AI SDK https://ai-sdk.dev/docs/ ; Zod https://zod.dev/ ; Node https://nodejs.org/api/ . APIs checked against installed package docs. Runtime provider/model is configured, not guessed.
## Decisions and Open Issues
User expanded scope to P1/P2 after initial discovery. Full coverage is tracked rather than silently dropping roadmap features. No OpenAI or gateway API key was found in the process environment or project env files. Integration destination, organizer pilot and user final review remain outstanding. Direct OpenAI support uses an operator-overridable model default. No claim of complete skill-pack learning steps or benchmark results until performed.
