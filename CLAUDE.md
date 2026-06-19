# CLAUDE.md

Guidance for AI assistants (Claude Code and others) working in this repository.

## What this is

**Agent Gourab — Career AI** is a single-page, static web front-end for an
AI chat agent that represents **Gourab Basu** (an enterprise sales executive)
to recruiters and hiring managers. Visitors register, then chat with an
LLM-backed "Agent Gourab" that answers questions about his career, deals,
and fit for a given role. Sessions are logged and Gourab is notified afterward.

The site is deployed as a static page on a custom domain
(`gourabbasu.getbriefed.to`, see `CNAME`) — there is no build step and no
server-side code in this repository.

## Repository layout

This repo is intentionally tiny:

- `index.html` — the **entire application**: HTML, CSS (in a `<style>` block),
  and JavaScript (in a `<script>` block) all in one file (~750 lines).
- `CNAME` — custom domain for static hosting (e.g. GitHub Pages / similar).
- `CLAUDE.md` — this file.

There is **no** `package.json`, bundler, framework, test suite, or
dependency install. Everything runs directly in the browser.

## Architecture

The front-end is a pure client; all intelligence lives in a **separate backend
API that is NOT in this repo**.

- API base URL is hard-coded near the top of `index.html`:
  ```js
  const API = 'https://agent-gourab-api.onrender.com';
  ```
- External dependency: the **Satoshi** font, loaded from Fontshare via `<link>`.

### Backend endpoints the front-end calls

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/register` | POST | Create a session from gate form (name, email, company, roleContext). Returns `token`, `session_id`, `interviewer_id`, `company_id`, plus returning-visitor info (`returning`, `prior_sessions`, `company_prior_sessions`). |
| `/chat` | POST | Send the full `messages` array; response is a **streamed** text body read via `response.body.getReader()`. |
| `/end-session` | POST | Mark a session done (also used for inactivity timeout and extension requests). |
| `/session-state/:sessionId` | GET | Poll whether the session budget is still `exhausted`. |

### Streaming + control signals

`/chat` returns a plain text stream that is appended to the agent bubble as it
arrives. The stream may contain inline **sentinel tokens** that the client must
detect and strip from the displayed text:

- `__AUTH_EXPIRED__` — token expired; client tells user to resend and rolls
  back the last user message + `questionCount`.
- `__BUDGET_SIGNAL__` — followed by `warn` (≈80% of budget used) or
  `exhausted` (budget reached). On `exhausted`, the send button is disabled and
  an "Request More Time" extension flow appears.

When editing the streaming loop in `sendMessage()`, preserve this sentinel
handling — these strings must never be shown to the user.

### Client session state

Session is tracked in module-level `let` variables in the main `<script>`
(`sessionToken`, `sessionId`, `interviewerId`, `companyId`, `interviewerName`,
`interviewerEmail`, `interviewerCompany`, `activeRole`, `questionCount`,
`budgetExhausted`, etc.). There is no persistence — a page reload starts over.

### Key UI flows

- **Gate overlay** (`#gate-overlay`): blocks the app until the visitor submits
  name + valid email + company (all required; `submitGate()`). Role is optional.
- **Role context** (sidebar): `setRole()` stores `activeRole`; the first chat
  message is prefixed with `[ROLE CONTEXT: hiring for: …]` so the agent tailors
  answers. `clearRole()` resets it.
- **Inactivity timer**: 10 minutes (`INACTIVITY_MS`) auto-ends the session
  silently via `endSessionSilent('timeout')`.
- **Done overlay** (`#done-overlay`): shown after `endSession()` succeeds.

## Conventions

- **Single-file app.** Keep HTML, CSS, and JS in `index.html` unless there is a
  strong reason to split. Match the existing style: section banner comments
  (`// ── Section ───`), 2-space indentation, vanilla JS (no frameworks).
- **Styling** uses CSS custom properties defined in `:root` (`--bg`, `--accent`,
  `--text`, etc.). Reuse these tokens rather than hard-coding colors.
- **No new build tooling or npm dependencies** without explicit reason — this is
  deliberately a zero-build static page.
- **Branding facts** (e.g. "23 years", "$135M largest deal", "$400M+ career TCV",
  contact `gourab.bec@gmail.com` / `612-867-4133`) appear in multiple places
  (stats bar, welcome, footers, overlays). If a number changes, update **all**
  occurrences for consistency.
- Use `escapeHtml()` for user-authored text and `formatMessage()` (which renders
  `**bold**`, highlights metrics, and converts newlines) for agent text. Don't
  inject untrusted text as raw HTML.

## Local development

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

Note the app will call the live backend at `agent-gourab-api.onrender.com`.
To test against a local backend, change the `API` constant in `index.html`.

## Git workflow

- Active development branch: **`claude/claude-md-docs-4vzjs2`**.
- Commit with clear, descriptive messages; push with
  `git push -u origin claude/claude-md-docs-4vzjs2`.
- Do **not** open a pull request unless explicitly asked.
- Editing `CNAME` changes the live custom domain — only touch it intentionally.
