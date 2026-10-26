# BriefCheck

An independent organizer workspace for reviewing hackathon instructions: **evidence → example → decision → retest**.

Paste or import event materials, compare supported requirements, inspect exact source passages, test boundary cases, record a decision, edit a local draft, and rerun. Original source snapshots remain in the review history.

## Run locally

Requires Node.js **22.13+** (tested with 25.2.1) and npm.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Load the synthetic sample and choose **Review instructions**. No API key is needed for deterministic review. The sample goes through the actual analysis pipeline; it is not a recorded answer.

```sh
npm run check                 # regression tests + TypeScript + production build
NODE_ENV=production npm run dev
```

The application binds to loopback by default. Browser tests require a running local server:

```sh
npx playwright install chromium
node tests/browser.mjs
node tests/api.mjs
node tests/imports.mjs
node tests/accessibility.mjs
node tests/keyboard.mjs
```

`CHROME_PATH` can select an existing compatible Chromium binary. API tests create disposable accounts and delete their test workspace; use a dedicated test database (`BRIEFCHECK_DB=:memory:`) when running a test server.

## Live OpenAI or AI Gateway extraction

Copy `.env.example` to `.env` and configure either:

```dotenv
OPENAI_API_KEY=your-local-key
BRIEFCHECK_MODEL=gpt-5-mini
```

or:

```dotenv
AI_GATEWAY_API_KEY=your-local-gateway-key
BRIEFCHECK_MODEL=provider/model-id
```

Restart the server, then select **AI-assisted**. Direct OpenAI uses the Responses API through the AI SDK; `gpt-5-mini` is the configurable default, verified to support structured outputs in the [official model reference](https://developers.openai.com/api/docs/models/gpt-5-mini). Set a model available to your account. Do not commit `.env` or put a key in browser code. Direct OpenAI takes precedence when both keys are set.

Live AI transfers supplied text to the configured provider. The application does not claim zero provider retention. Configure your provider's retention and monetary spend limits before using sensitive documents or exposing a hosted demo. `BRIEFCHECK_MAX_AI_REVIEWS` is a per-process request ceiling, **not** a monetary budget. There are at most two provider calls per review, a 60-second timeout, bounded output, concurrency control, and request throttling. Failed extraction never silently becomes deterministic output.

**No live key was available during implementation. Live provider quality, latency, cost, and multilingual accuracy are not yet verified.** Mocked tests cover schema validation, exact multilingual quotes, and bounded repair; they do not establish model accuracy.

## Features

- Two to four labeled sources, 40,000 combined characters; duplicate detection and explicit coverage expectations.
- Public HTTPS imports with DNS pinning, private-network blocking, checked redirects, size/time limits; text-PDF imports with page provenance. No authenticated imports, OCR, crawling, or scripted-page rendering.
- Explicit English deterministic extraction for video duration, team size, zoned deadlines, criterion sets, and common deliverables. Unsupported wording remains unreviewed or unresolved.
- Optional structured AI extraction, source-language evidence, modality, scopes, conditions and exceptions. Restricted comparison/set/Boolean evaluation never executes source or model code.
- Exact evidence offsets, SHA-256 source hashes, immutable review snapshots, source-to-topic graph and coverage counts.
- Boundary tests, custom typed scenario facts, saved tests, reruns, and honest unresolved states when evidence disappears.
- Accept/dismiss/defer decisions; organizer interpretation corrections; intentional policy suggestions; draft revision reasons, undo, baseline comparisons and downstream references.
- Organizer-approved clarification records, printable HTML and structured JSON exports. Full source inclusion is opt-in; evidence quotes are always included.
- Explicit private saving in SQLite, password login, owner/editor/reviewer access, optimistic concurrency, access revocation and workspace deletion.
- Private reusable source templates and an authenticated HTTPS report webhook for an operator-selected integration destination.

## Storage and access

Anonymous reviews live in browser memory. Explicit private saves go into `.data/briefcheck.sqlite`. The database and `.env` are ignored by Git. No operational analytics or source-text logging is enabled. Accounts use salted scrypt password hashes and 24-hour HttpOnly, SameSite sessions. Reviewers may record decisions but cannot overwrite saved source documents; owners control access and deletion.

For remote use, supply a persistent writable volume, HTTPS reverse proxy, `BRIEFCHECK_SECURE_COOKIE=true`, `BRIEFCHECK_HOSTNAME`, and an appropriate bind address. This local prototype has not been load-tested or independently security-audited for public hosting. A single-process SQLite store and per-process rate limits are not a distributed deployment design.

Set `BRIEFCHECK_WEBHOOK_URL` and optionally `BRIEFCHECK_WEBHOOK_TOKEN` for a report destination you control or are authorized to use. Sending requires sign-in and a separate explicit UI confirmation. No webhook was contacted during implementation. This generic connector is not a claim of native Devpost, Slack, Jira, or Notion integration.

## Evidence and limits

- [Full PRD traceability](devpost/requirements-status.md)
- [Verification record](devpost/verification.md)
- [Development evaluation raw results](evaluation/development-results.json)
- [Held-out evaluation raw results](evaluation/heldout-results.json)
- [Hackathon checklist](devpost/hackathon-checklist.md)
- [App map](devpost/app-map.html)

The 40-case evaluation is synthetic and agent-labeled. It is not independent human evaluation, a production accuracy estimate, or a comparison against a simple LLM prompt. Exact quote validity does not prove interpretation correctness. The tool does not decide eligibility, legal compliance, plagiarism, or winners, and is not endorsed by Devpost.

## Provenance

Created as new source code for Build With AI: Basics on October 25, 2026 (America/Chicago). The supplied `BriefCheck_Product_Requirements.docx` is pre-existing product planning; its extracted contents are preserved in `devpost/source-prd.txt`. The official MIT-licensed Devpost Learn skills are included under `skills/`; planning records identify actual authorization and outstanding learner review rather than fabricating completed interviews. Third-party dependencies and their licenses are recorded by `package-lock.json` and their installed package metadata. Synthetic fixtures are authored for this project; the public example contains short dated criterion-name excerpts with source links.
