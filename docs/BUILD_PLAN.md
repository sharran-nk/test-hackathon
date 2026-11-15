# Build Plan (150 minutes)

> **Historical document (written before the build).** Authentication here is the shared `ACCESS_KEY` and the history routes are `/api/results`. Both were replaced: see `README.md`, `SOLUTION_DESIGN.md` and Decisions 13 to 15 for what exists now. Not updated line by line.

Status: plan only. No code is written. Sources: `SOLUTION_DESIGN.md`, `docs/REQUIREMENTS.md`, `docs/DECISIONS.md` (Decisions 1-12), `docs/ARCHITECTURE_FULL.md`.

The design's 150 minutes had **zero buffer**. This plan keeps 150 but reserves a 15-minute buffer and adds Milestone 5 (README, GitHub Actions). To pay for that, some estimates are tighter than the design's. That is a real risk: M4 is where the buffer will most likely be spent.

## Time budget
| M | Work | Min | Design said |
|---|---|---|---|
| 1 | Scaffold, parse, rules, `/api/check`, tests | 58 | 63 |
| 2 | React dashboard | 26 | 33 |
| 3 | Docker, Compose (app only), EC2 deploy | 15 | 18 |
| 4 | MongoDB, history, db tests, redeploy | 24 | 36 |
| 5 | README, GitHub Actions | 12 | not in design |
| | **Buffer** | **15** | 0 |
| | Total | 150 | |

**Pre-work outside the clock (start first):** launch EC2 (at least 2 GB RAM, 20 GB disk), security group (3000 open, 22 from my IP only), install Docker and Compose, generate a throwaway `ACCESS_KEY`.

## Decisions to confirm
1. **Layout:** `app/package.json` is the one Node package (server and tests). `app/server/`, `app/client/` (own `package.json` for Vite), tests in `app/tests/`. REQUIREMENTS.md said `tests/`; its path column will be corrected.
2. **Dependencies:** runtime `express`, `mongoose` (M4); client `react`, `react-dom`, `vite`, `@vitejs/plugin-react`; dev `jest`, `supertest`. Nothing else. No `mongodb-memory-server`: db tests use the real Compose `mongo` service, so Docker must be running for M4 tests.
3. **Sample data:** the client imports the three seed CSVs with `?raw` from a copy in `app/client/src/sample/`, so the button makes no network call. Names in the seed are dropped by the server.
4. **Rules engine is pure:** `rules/` has no HTTP or database code.

## Milestone 1: checker API, no database (58 min)

**1.1 Scaffold, `/health`, logging, config (8)**
- Files: `app/package.json`, `app/server/index.js` (app factory) + `server.js` (listen), `config.js` (throws if `ACCESS_KEY` missing), `logger.js` (one JSON line per request: method, path, status, ms, requestId; no body, no key), `.env.example`, `.gitignore`, `.dockerignore`.
- Tests (`api.test.js`): `/health` 200 `{status:"ok"}`; unknown route 404 JSON.
- Accept: `npm test` runs; server refuses to start without `ACCESS_KEY`; `.env` untracked.

**1.2 CSV parser and row validation (12)**
- Files: `parse/csv.js` (split lines and commas, trim, strip BOM and `\r`), `parse/validate.js` (header; field count; ID format; real calendar date; `HH:MM`; end after start; names, roles, hours dropped; unknown employee or store gives `UNKNOWN_REF`; bad row gives `DATA_BAD_ROW` with file and line and is skipped; reused `shift_id` with different content gives `DATA_BAD_ROW`). Known stores = distinct `home_store` (assumption).
- Tests (`parse.test.js`): wrong header; wrong field count; `31/11/2026` and `2026-02-30`; bad time; end <= start; unknown employee and store; names absent from output; empty leave file; CRLF and BOM.
- Accept: bad rows never throw; seed shifts give exactly one bad row (SH086, line 87).

**1.3 Rules engine (25)**
- Files: `rules/duplicate.js`, `overlap.js` (sweep-line per employee sorted `(start,end,shift_id)`; drop active with end <= start; pair with every remaining active; stop at `MAX_FINDINGS`, set `truncated`), `rest.js` (latest-end tracking, skip when overlapping, under 11h flagged, exactly 11h allowed), `leave.js` (approved only, inclusive), `index.js` (dedupe, refs, overlap/rest/leave, sort, `seq`, summary).
- Tests (`rules.test.js`): SH024/SH025; cross-store SH033/SH041 names both stores; nested (09-17 with 10-12 and 13-15 gives 3 pairs); three-way; touching is not overlap; same start; 11h allowed, 10h59 flagged; leave first day, last day, day after; pending leave ignored; duplicate reported once, not as self-overlap; shuffled rows give identical output; `MAX_FINDINGS` sets `truncated`.
- Accept: all pass, output deterministic. Caveat recorded: touching shifts raise `SHORT_REST` (0h gap), "to confirm".

**1.4 `POST /api/check` (8)**
- Files: `auth.js` (SHA-256 both sides, `timingSafeEqual`, `Bearer` only), `routes/check.js`, body limit (`MAX_BODY_KB`), field validation (strings only), central error handler (400 `INVALID_REQUEST`, 401, 404, 413 `TOO_LARGE`, 500 with `requestId`; body `{error:{code,message}}`). Response: `{resultId:null, saved:false, createdAt, summary, findings}`. Order: key, size, JSON and fields, parse, rules.
- Tests (`api.test.js`): 200 valid; 401 missing, wrong, wrong scheme; 400 bad JSON, non-string field, empty shifts, wrong header; 413 oversize; key string absent from 400/401/500 bodies; finding fields present.
- Accept: no input crashes the process.

**1.5 Seed answer key (inside the 58, about 5)**
- File: `app/tests/seed.test.js` reading `case/seed/*.csv` through the API.
- Test: exactly 6 findings (same-store OVERLAP, cross-store OVERLAP, ON_LEAVE, SHORT_REST, DUPLICATE_ROW, DATA_BAD_ROW) on the right shift IDs, `clear:false`, nothing for L002-L005.
- Accept: zero false positives on the other 155 shifts. **This is the M1 gate.**

**M1 exit:** pasted `npm test` output, `curl` of the seed against the local server, commit.

## Milestone 2: React dashboard served by Express (26 min)
**2.1 Vite app (20).** Files: `app/client/package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx` (one file, `useState`), `src/App.css`, `src/sample/*.csv`. UI: key box (password, state only; 401 clears it), three file pickers (`FileReader`), sample-data button, Check button (built-in `fetch` with `Authorization: Bearer`, so no Axios), red/green banner with text and counts per rule, skipped rows and truncation notice, findings table with text severity badges, data-quality box, unencrypted-HTTP notice, History panel showing "History unavailable" (wired in M4). No `dangerouslySetInnerHTML`, no browser storage, no external URLs or fonts.
**2.2 Express serves the build (6).** Edit `index.js` to serve `app/client/dist`, SPA fallback for non-`/api` GETs only.
- Tests: one Supertest check that `GET /` returns 200 HTML when `dist` exists; the rest is a manual checklist in `docs/DEMO.md` (no UI tests, per design).
- Accept: key, sample button, red banner with the six seed findings; clean roster shows green; reload asks for the key; wrong key shows an error.
- Grep gate before commit: no `localStorage|sessionStorage|document.cookie|dangerouslySetInnerHTML|VITE_` in `app/client/src`.

## Milestone 3: Docker, Compose, first deploy (15 min)
- Files: `Dockerfile` (multi-stage; build stage runs `vite build`; runtime `node:*-alpine`, production deps only, non-root, `HEALTHCHECK` on `/health`), `docker-compose.yml` (only `app`; port 3000; `env_file: .env`; `restart: unless-stopped`), `.env.example`.
- Local gate (about 5 min): `docker compose up --build`, `curl /health`, seed through the container.
- Deploy: clone on EC2, create `.env` with the temporary key, `docker compose up -d --build`, check `http://<ip>:3000/health` and the sample check.
- Tests: `/health` and sample run shown as output; from another machine 3000 answers, 22 and 27017 do not.
- Accept: live URL returns the six findings; HTTP-only notice visible; container restarts after `docker kill`. **Put the URL in the README now**, so a late finish still has a working hand-in.
- Risk: first build on a small instance is slow.

## Milestone 4: MongoDB (24 min)
**4.1 Models, save, history routes (10).** Files: `db.js` (connect only if `MONGODB_URI`; 5 s server-selection timeout; `bufferCommands:false`; background retry; state for `/health`), `models/Roster.js`, `ValidationResult.js`, `Finding.js` (strict; TTL on `expiresAt` from `RETENTION_DAYS`; no name fields), `routes/results.js` (`GET /api/results?limit` default 20 max 50; `GET /api/results/:id` with ID validation, 400/404; 503 `DB_UNAVAILABLE`). Edit `check.js` to save roster, findings, result last; on failure log (no URI) and return `saved:false`. `/health` adds `db`.
**4.2 Compose and env (3).** `mongo` service (pinned image, auth, volume `mongo_data`, no `ports`, healthcheck), `MONGODB_URI` built from `MONGO_ROOT_*`, `app` waits for healthy but tolerates a late DB.
**4.3 History UI (4).** Wire list and reopen in `App.jsx`; "History unavailable" on 503.
**4.4 DB tests (6)** in `db.test.js`, real Compose mongo, separate test database: round trip with same findings in same order; no name, role or hours stored; TTL index exists and `expiresAt` is about now + `RETENTION_DAYS`; bad ID 400; unknown valid ID 404; unreachable DB gives check 200 `saved:false`, history 503, no URI or password in responses or captured logs.
**4.5 Redeploy and live check (about 1, then buffer).** `/health` shows `db:"up"`; run a check and see it in History after a reload; `docker compose stop mongo` and confirm `saved:false`; 27017 not reachable externally.
- Accept: M1 and M2 tests pass unchanged.
- **If M4 is not finished:** keep it on a branch, do not merge half-done DB code. The deployed M3 build stays, with `saved:false` and "History unavailable", and the README and SOLUTION_DESIGN say the saved-results requirement is not met.

## Milestone 5: README and CI (12 min)
- **README.md (7):** purpose, live URL, HTTP-only and fictional-data warning, run locally, env vars, API table, tests, limits (quoted commas, touching-shift `SHORT_REST`, no accounts, no backups, 1 MB cap), dependency list with reasons, answers to 10x, no third-party APIs, build vs buy.
- **`.github/workflows/test.yml` (5):** checkout, Node, `npm ci`, `npm test`, `mongo` service container so `db.test.js` runs. Accept: green run, shown with `gh run list`.
- Also: update `docs/REQUIREMENTS.md` (status `verified` only where I ran the test and saw output; fix paths) and `docs/DEMO.md`.
- Only if buffer remains: FR-26, FR-18, FR-19, FR-15, FR-22 in that order. FR-20 AI is not planned.

## Buffer (15 min) and what to cut first
The buffer is unscheduled and is spent only on overruns. If still short, cut in this order:
1. All Should items and AI.
2. Dashboard styling beyond banner, badges and table; the data-quality box becomes a plain list.
3. The `mongo` service in GitHub Actions (CI runs non-DB tests only).
4. Extra tests (`perf`, `logging`, `config`, `security`) stay out, replaced by the grep gate and a manual 150-shift timing.
5. **Milestone 4 shrinks or goes.** Inside M4, in priority: save plus `GET /api/results/:id`, then db tests, then History UI, then TTL.
6. **Never cut:** rules, the seed answer-key test, the key check, the M3 deploy, the README.

## Working rhythm (CLAUDE.md rules 8, 9, 11)
Per feature: run tests and show output, commit, then a 5-line explanation and 3 likely panel questions. This is not counted in the minutes.

## Risks
- Tight estimates: M2 26 vs 33, M4 24 vs 36.
- Windows dev machine: Docker Desktop must be running for M3 and M4; CRLF handling is tested for this reason.
- The EC2 public IP changes if the instance stops; don't stop it during judging.
- Mongoose is new to me; M4 notes will explain it.
