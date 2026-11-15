# Requirements

Sources: `case/brief.md`, `docs/PROBLEM.md`, `docs/ASSUMPTIONS.md` (IDs such as B1 and D3), and the Decision log in `docs/DECISIONS.md` ("Decision N"). The brief is incomplete on purpose, so many requirements rest on **unconfirmed assumptions**. Where one does, its ID is cited. None of them is a confirmed customer requirement.

**Mandatory stack (set by the user):** React + Vite, Node.js + Express, MongoDB with Mongoose, Docker and Docker Compose, AWS EC2. The demo is served over plain HTTP (no HTTPS), with fictional data and a temporary key.

**Priority:** Must = in the first build. Should = built if time is left after the Musts. Could = only if everything else is done.
**Status:** `planned` → `implemented` (code exists) → `verified` (tests were run and passed, output seen). The first build covers the Must items only.

## Build scope

**First build: 150 minutes** (see `SOLUTION_DESIGN.md` and `docs/DECISIONS.md`). It contains every Must item: FR-01 to FR-14, FR-21, FR-23, FR-24, FR-25, FR-27, and all non-functional requirements that are not marked Should or Could. That includes MongoDB persistence and the dashboard History list. The core pipeline (parse, validate, de-duplicate, overlap, rest and leave rules, summary), the API, the presentable dashboard and their tests work with nothing else present. In particular, **the core pipeline does not depend on MongoDB, FR-15 fix hints or FR-20 AI explanation.**

**Build order (the way to protect the deadline).** Four milestones, in this order. Each one leaves a working app, and MongoDB is last on purpose:

1. **Milestone 1: rules and `POST /api/check`**, tested locally with no database.
2. **Milestone 2: React dashboard** with the sample-data button, red or green banner, severity badges and findings table.
3. **Milestone 3: deploy to EC2** with only the `app` service in Compose, and check the live URL.
4. **Milestone 4: add MongoDB:** Mongoose models, saving, the history routes, the `mongo` service in Compose, the History list and the database tests. Then redeploy.

**If time runs out before milestone 4,** the deployed app still works: `POST /api/check` returns its findings with `saved: false`, and the dashboard shows the History list as unavailable. Nothing before milestone 4 depends on the database.

**Should, after the Musts are verified and deployed:** NFR-R11 (GitHub Actions workflow that runs the tests on every push), FR-26 (delete a saved result), FR-18 (filters), FR-19 (JSON download), FR-15 (fix hints), and the extra tests.
**Could, last:** FR-22 (configurable rest hours) and FR-20 (AI explanation, the lowest priority).

FR-16 and FR-17 are Should, but their checks (seed answer key, row-order test) sit inside the test step because they test the Must rules.

## 1. Functional requirements

### Must (first build)

| ID | Requirement | Source |
|---|---|---|
| FR-01 | `POST /api/check` accepts employees, shifts and leave as CSV text inside a JSON body, runs the check, saves the outcome (FR-23) and returns it. If saving isn't possible, it still returns the findings with `saved: false`. | Decision 3, D1, Decision 12 |
| FR-02 | CSV parsing is hand-written. Rows are validated (field count, IDs, date and time format). Quoted commas are not supported, and the README says so. A bad row is reported and skipped. It never stops the check. | Decision 1, D4, D5 |
| FR-03 | A missing or malformed date or time is reported as a data finding. Seed example: SH086. | D4, D5 |
| FR-04 | An exact duplicate row is reported once as a duplicate and left out of the other rules, so it never counts as an overlap. Seed example: SH091. | D3 |
| FR-05 | Two overlapping shifts for one person at the same store are a finding. Every overlapping pair is reported, including nested shifts (one fully inside another) and three or more shifts that overlap together. Reporting stops at `MAX_FINDINGS` (my assumption: 1000), and the summary then says `truncated: true`, so it is never silent. Seed example: SH024 and SH025. | B1 |
| FR-06 | Two overlapping shifts for one person at different stores are a finding that names both stores. Seed example: SH033 and SH041. | B1, U4 |
| FR-07 | Touching shifts (one ends when the next starts) are not an overlap. | Decision 4 |
| FR-08 | A shift on a day of approved leave is a finding. Only `approved` leave counts. Leave runs from `start_date` to `end_date`, both included. Seed example: SH098. | D7, D8 |
| FR-09 | Less than 11h between the end of one shift and the start of the next is a finding. Exactly 11h is allowed. Seed example: SH013 and SH021. | B3, Decision 4 |
| FR-10 | Each finding has a rule ID, a severity, the employee ID, the shift IDs involved and a plain-language message. | PROBLEM.md success measures |
| FR-11 | The response has a summary: finding counts per rule, the number of rows skipped, `truncated`, and a clear or not-clear flag. It also says whether the result was saved (`saved`, `resultId`). `saved` is `false` and `resultId` is `null` if saving failed or MongoDB is not deployed yet (milestones 1 to 3). It is advisory only and never blocks anything. | B2 |
| FR-12 | An unknown employee ID or store ID in a shift or leave row is reported, and the run continues. | D9 |
| FR-13 | Every `/api` request must carry the shared key from `ACCESS_KEY` in an `Authorization: Bearer <key>` header, or it is rejected with 401. | Decision 2, S2 |
| FR-14 | The React dashboard asks the user to type the key manually, loads the 3 CSV files, sends them to the API, and shows the result: a red (problems found) or green (clear) summary banner, each finding as a row in a table with a severity badge, readable IDs, times and messages. The key is never part of the frontend source or build, and is held in memory only (NFR-S2, NFR-S6). | Decision 2, Decision 5, Decision 11 |
| FR-21 | The dashboard has a sample-data button that loads the three seed files (employees, shifts, leave) in one click, so the demo needs no file picking. | Decision 11 |
| FR-23 | Each completed check is saved in MongoDB through Mongoose: the roster rows that passed validation (IDs, stores, dates, times, leave ranges, **no names**), the validation result and its findings. | Decision 7, D10, S1, Decision 12 |
| FR-24 | `GET /api/results` lists saved results, newest first, with their summaries. | Decision 7, Decision 12 |
| FR-25 | `GET /api/results/:id` returns one saved result with its findings in the original order. An unknown or expired ID gives 404. | Decision 7, Decision 12 |
| FR-27 | The dashboard has a History list of earlier saved results, and one can be reopened. If the API says history is unavailable (503), the dashboard says so and the rest still works. | Decision 12 |

### Should

| ID | Requirement | Source |
|---|---|---|
| FR-15 | Each finding carries a **deterministic fix hint** made from a fixed template per rule (no AI), for example "Move one of the shifts, or end the first before the second starts." The hint is an added field. Findings, the summary, the API and the Must tests are complete without it, and a missing or failing hint step never changes or removes a finding. | PROBLEM.md F7 |
| FR-16 | On the seed data the checker returns exactly the 6 planted problems and nothing else: **zero false positives** (answer key: `case/seed/README.md`). | PROBLEM.md success measures |
| FR-17 | The result doesn't depend on the order of the rows. | D1, ASSUMPTIONS edge cases |
| FR-18 | The dashboard can filter findings by rule or severity. | Decision 5 |
| FR-19 | The dashboard can download the findings as a JSON file. | I3 |
| FR-26 | `DELETE /api/results/:id` deletes a saved result with its findings and roster. | S1 |

### Could

| ID | Requirement | Source |
|---|---|---|
| FR-20 | **Optional AI explanation.** The rules decide every finding. AI only rewrites the explanation text for findings that already exist. It must never create, remove, modify or influence findings. It is off by default (`AI_MODE=off`). Only IDs, times and rule names are sent, never names. There is a 10s timeout and a fallback to the fixed template text. No chat, summaries, prioritisation, recommendations or any other AI function. | Decision 6, I4 |
| FR-22 | The minimum rest hours and the leave statuses that count are set by environment variables. | O4, D7 |

## 2. Non-functional requirements

### Security

| ID | Requirement | Source |
|---|---|---|
| NFR-S1 | The `ACCESS_KEY` is compared in constant time. It is never logged and never returned in any response, including error responses. | Decision 2 |
| NFR-S2 | No secrets in code or git. `ACCESS_KEY` is never hardcoded in the frontend source and never baked into the build (no `VITE_` variable). `.env.example` is committed and `.env` is not. | CLAUDE.md, Decision 2 |
| NFR-S3 | Request size is limited and every field is validated before use. Uploaded text is untrusted. No request value is put into a database query as an object, and result IDs are checked to be valid before use. | S3 |
| NFR-S4 | The app makes no outside calls (no CDN scripts, fonts or analytics). The dependency list is short and stated in the README. | I2 |
| NFR-S5 | The dashboard shows findings as text, never as raw HTML. | S3 |
| NFR-S6 | The key the user types is kept in frontend memory only. It is never written to `localStorage`, `sessionStorage`, cookies or the URL, so a page reload asks for it again. | Decision 2 |
| NFR-S7 | The deployed demo is served over **plain HTTP** at the EC2 public IP, and says so: the README and the dashboard show "Demo over unencrypted HTTP, fictional data only". It must be used only with fictional roster data and a temporary access key. Only the application port (3000) is published. SSH is open only from the user's IP, and the MongoDB port is never published. | Decision 9 |
| NFR-S8 | Database credentials exist only in server-side environment variables. They are never in frontend code, API responses or logs. Connection errors are logged without the connection string. | Decision 7 |

### Privacy

| ID | Requirement | Source |
|---|---|---|
| NFR-P1 | Names never appear in logs. Logs use IDs only. | S1 |
| NFR-P2 | Stored data is minimal: employee ID, home store, shift and leave fields, and findings. **Employee names, roles and contracted hours are dropped when the files are read and are never stored.** | S1, Decision 7 |
| NFR-P3 | AI input never contains names. | Decision 6 |
| NFR-P4 | The dashboard shows employee IDs only, because names are not stored. | S1 |
| NFR-P5 | Every stored record has an expiry date. MongoDB deletes saved rosters, results and findings after `RETENTION_DAYS` (my assumption: 30). | S1, ASSUMPTIONS |

### Performance

| ID | Requirement | Source |
|---|---|---|
| NFR-F1 | A check of about 150 shifts finishes in under 2 seconds, including saving. This is a target I will measure, not a result yet. | PROBLEM.md |
| NFR-F2 | Overlap detection uses a sweep-line with an active set. Shifts are grouped per employee and sorted by start. Before each shift is compared, shifts in the active set that end at or before its start are removed (so touching shifts are not overlapping). The shift is then paired with every shift still active. This finds all overlapping pairs, including nested ones. The cost is O(n log n + k), where k is the number of overlapping pairs reported (at most `MAX_FINDINGS`). | D2, Decision 4 |
| NFR-F3 | There is a request size limit. The value is not decided. My assumption is about 1 MB. | S3, D2 |

### Reliability

| ID | Requirement | Source |
|---|---|---|
| NFR-R1 | Malformed input never crashes the server. It returns a clear 4xx error. | D4, CLAUDE.md |
| NFR-R2 | `GET /health` returns the service status and whether the database is up. | CLAUDE.md |
| NFR-R3 | Logging is structured (JSON lines), with no personal data. | CLAUDE.md, O3 |
| NFR-R4 | The same input always gives the same output, in the same order. | PROBLEM.md N1 |
| NFR-R5 | If AI is on and fails or times out, the template text is used and the findings are unchanged. | Decision 6 |
| NFR-R6 | All configuration comes from environment variables, including the MongoDB connection. | CLAUDE.md |
| NFR-R7 | All containers restart after a crash or a reboot. | O1, O2 |
| NFR-R8 | Every requirement that can practically be tested from code has an automated test (Jest and Supertest), and tests run before each commit. The few that can't are listed in section 4 as manual checks, each with the reason. | CLAUDE.md |
| NFR-R9 | If MongoDB is down or a database write fails, `POST /api/check` still returns the findings, with `saved: false`. The history routes return 503 `DB_UNAVAILABLE`. The app starts and keeps retrying the connection. | Decision 7 |
| NFR-R10 | Saved results survive a container restart (MongoDB data is on a named volume). | Decision 8 |
| NFR-R11 | **(Should)** A GitHub Actions workflow runs the automated tests on every push. | Decision 11 |

## 3. Traceability

All paths are **proposed**. Nothing is built yet. Correct the File and Test columns as files appear. Layout assumed: `app/server/` for Express, the rules and the models, `app/client/` for React and Vite, tests in `app/tests/`. Items without an automated test are marked "manual" and explained in section 4.

| Req ID | Requirement | Priority | Feature or endpoint | File | Test | Status |
|---|---|---|---|---|---|---|
| FR-01 | Accept CSV text in a JSON body, check, save, return | Must | `POST /api/check` | `app/server/routes/check.js` | `app/tests/api.test.js` | implemented |
| FR-02 | Hand-written CSV parse and row validation | Must | CSV parser | `app/server/parse/csv.js` | `app/tests/parse.test.js` | verified |
| FR-03 | Missing or malformed date or time reported | Must | Rule `DATA_BAD_ROW` | `app/server/parse/validate.js` | `app/tests/parse.test.js` | verified |
| FR-04 | Exact duplicate reported once, excluded from other rules | Must | Rule `DUPLICATE_ROW` | `app/server/rules/duplicate.js` | `app/tests/rules.test.js` | verified |
| FR-05 | Same-store overlap; all pairs incl. nested and 3-way; truncation flag | Must | Rule `OVERLAP` | `app/server/rules/overlap.js` | `app/tests/rules.test.js` (seed pair, nested, 3-way, cap) | verified |
| FR-06 | Cross-store overlap names both stores | Must | Rule `OVERLAP` (cross-store) | `app/server/rules/overlap.js` | `app/tests/rules.test.js` | verified |
| FR-07 | Touching shifts are not an overlap | Must | Rule `OVERLAP` boundary | `app/server/rules/overlap.js` | `app/tests/rules.test.js` (end = start) | verified |
| FR-08 | Shift on approved leave | Must | Rule `ON_LEAVE` | `app/server/rules/leave.js` | `app/tests/rules.test.js` | verified |
| FR-09 | Under 11h rest; exactly 11h allowed | Must | Rule `SHORT_REST` | `app/server/rules/rest.js` | `app/tests/rules.test.js` | verified |
| FR-10 | Finding fields: rule, severity, employee, shifts, message | Must | Response `findings[]` | `app/server/rules/index.js` | `app/tests/api.test.js` | verified |
| FR-11 | Summary with counts, skipped rows, truncated, clear, saved | Must | Response `summary` | `app/server/routes/check.js` | `app/tests/api.test.js` | implemented |
| FR-12 | Unknown employee or store ID reported | Must | Rule `UNKNOWN_REF` | `app/server/parse/validate.js` | `app/tests/parse.test.js` | verified |
| FR-13 | Shared key required in `Authorization: Bearer` header | Must | Auth middleware | `app/server/auth.js` | `app/tests/api.test.js` (missing, wrong, right key; wrong scheme; also on history routes) | implemented |
| FR-14 | React dashboard: manual key entry, load files, red/green banner, severity badges, findings table | Must | Single-page UI | `app/client/src/App.jsx`, `app/client/src/Results.jsx` | manual (demo checklist) + `app/tests/security.test.js` (source scan) | implemented |
| FR-15 | Deterministic fix hints | Should | Hint templates | `app/server/rules/hints.js` | `app/tests/hints.test.js` | planned |
| FR-16 | Seed data gives exactly the 6 planted problems, no false positives | Should | Seed run | `case/seed/` | `app/tests/seed.test.js` (exactly 6 findings through the API) | verified |
| FR-17 | Result independent of row order | Should | Sorting in rules | `app/server/rules/index.js` | `app/tests/rules.test.js` | verified |
| FR-18 | Dashboard filter by rule or severity | Should | Results filter | `app/client/src/App.jsx` | manual | planned |
| FR-19 | Dashboard download findings as JSON | Should | Download button | `app/client/src/App.jsx` | manual | planned |
| FR-20 | Optional AI explanation, off by default | Could | Explain step, `AI_MODE` | `app/server/explain.js` | `app/tests/explain.test.js` | planned |
| FR-21 | Dashboard sample-data button loads the seed files in one click | Must | Sample button | `app/client/src/App.jsx` | manual (demo checklist) | implemented |
| FR-22 | Rest hours and leave statuses by env var | Could | Config | `app/server/config.js` | `app/tests/config.test.js` | planned |
| FR-23 | Save roster rows (no names), result and findings | Must | Persistence in `POST /api/check` | `app/server/models/*.js`, `app/server/routes/check.js` | `app/tests/db.test.js` (round trip; no names stored) | planned |
| FR-24 | List saved results, newest first | Must | `GET /api/results` | `app/server/routes/results.js` | `app/tests/db.test.js` | planned |
| FR-25 | Open one saved result; 404 if missing | Must | `GET /api/results/:id` | `app/server/routes/results.js` | `app/tests/db.test.js` | planned |
| FR-26 | Delete a saved result | Should | `DELETE /api/results/:id` | `app/server/routes/results.js` | `app/tests/db.test.js` | planned |
| FR-27 | Dashboard History list; reopen a saved result | Must | History list | `app/client/src/App.jsx` | manual | planned (placeholder section only) |
| NFR-S1 | Key compared in constant time; never logged or returned | Must | Auth middleware, logger | `app/server/auth.js` | `app/tests/api.test.js` (key absent from 401, 500 bodies and captured logs) | verified |
| NFR-S2 | No secrets in code or git; key not in frontend source or build | Must | `.env.example`, `.gitignore`, Vite build | `.env.example`, `app/client/` | `app/tests/security.test.js` (client source has no `ACCESS_KEY` or `VITE_` key use; built files don't contain the test key) + secret grep (in `/final`) | verified |
| NFR-S3 | Size limit, validation, safe IDs in queries | Must | Body limit, validation | `app/server/index.js`, `app/server/routes/results.js` | `app/tests/api.test.js` (bad ID, object in body) | implemented |
| NFR-S4 | No outside calls, short dependency list | Must | Whole app | `app/package.json` | `app/tests/security.test.js` (no URLs in source, short client dependency list) + manual network-tab check | implemented |
| NFR-S5 | Findings shown as text, not HTML | Must | React rendering | `app/client/src/App.jsx`, `app/client/src/Results.jsx` | `app/tests/security.test.js` (no `dangerouslySetInnerHTML`) + manual | implemented |
| NFR-S6 | Key in frontend memory only | Must | React state | `app/client/src/App.jsx` | `app/tests/security.test.js` (no `localStorage`, `sessionStorage` or `document.cookie`) + manual reload check | implemented |
| NFR-S7 | HTTP-only demo notice; only port 3000 published; Mongo port never published | Must | Compose `ports`, dashboard banner, README | `docker-compose.yml`, `app/client/src/App.jsx`, `README.md` | manual deploy check (section 4) | planned |
| NFR-S8 | DB credentials only server-side, never in responses or logs | Must | Config, logger, error handler | `app/server/config.js`, `app/server/db.js` | `app/tests/security.test.js`, `app/tests/db.test.js` (URI and password absent from responses and logs, including a connection failure) | planned |
| NFR-P1 | No names in logs | Must | Logger | `app/server/logger.js` | `app/tests/api.test.js` (request and 500 logs contain no key or names) | verified |
| NFR-P2 | Minimal stored data, no names | Must | Mongoose schemas | `app/server/models/*.js` | `app/tests/db.test.js` (stored documents contain no name, role or hours) | planned |
| NFR-P3 | No names sent to AI | Could | Explain payload | `app/server/explain.js` | `app/tests/explain.test.js` | planned |
| NFR-P4 | IDs only in the dashboard | Must | Response shape | `app/server/rules/index.js` | `app/tests/api.test.js` | verified |
| NFR-P5 | Expiry on every stored record | Must | TTL index on `expiresAt` | `app/server/models/*.js` | `app/tests/db.test.js` (TTL index exists, `expiresAt` set from `RETENTION_DAYS`) | planned |
| NFR-F1 | ~150 shifts in under 2s, including saving | Must | Whole check | `app/server/routes/check.js` | `app/tests/perf.test.js` | planned |
| NFR-F2 | Sweep-line overlap, O(n log n + k) | Must | Group, sort, active set | `app/server/rules/overlap.js` | `app/tests/rules.test.js` (nested, 3-way, touching, same-start, cap) + `app/tests/perf.test.js` | implemented |
| NFR-F3 | Request size limit | Must | Body parser limit | `app/server/index.js` | `app/tests/api.test.js` | verified |
| NFR-R1 | Bad input returns a clear 4xx, no crash | Must | Error handler | `app/server/index.js` | `app/tests/api.test.js` | verified |
| NFR-R2 | `GET /health` with database state | Must | Health route | `app/server/index.js` | `app/tests/api.test.js` (`db` field added in M4) | implemented |
| NFR-R3 | Structured logging | Must | Logger | `app/server/logger.js` | `app/tests/api.test.js` | verified |
| NFR-R4 | Same input, same output and order | Must | Whole check | `app/server/rules/index.js` | `app/tests/rules.test.js` | verified |
| NFR-R5 | AI failure falls back to template | Could | Explain step | `app/server/explain.js` | `app/tests/explain.test.js` | planned |
| NFR-R6 | Config from env vars only | Must | Config | `app/server/config.js` | `app/tests/api.test.js` (config describe block) | verified |
| NFR-R7 | Containers restart | Must | Compose restart policy | `docker-compose.yml` | manual (deploy check) | planned |
| NFR-R8 | A test per testable requirement, run before each commit; manual checks listed with reasons | Must | Test suite | `app/tests/` | this table and section 4 | planned |
| NFR-R9 | Database failure: check still returns findings; history gives 503 | Must | Persistence error handling | `app/server/db.js`, `app/server/routes/check.js` | `app/tests/db.test.js` (unreachable database) | planned |
| NFR-R10 | Saved results survive a restart | Must | Named volume for MongoDB | `docker-compose.yml` | manual deploy check (section 4) | planned |
| NFR-R11 | Tests run on every push | Should | GitHub Actions workflow | `.github/workflows/test.yml` | the workflow run itself (green check on GitHub) | planned |

## 4. Manual checks and why

Everything not listed here has an automated test in the table above. Database tests run against a real MongoDB (the Compose `mongo` service, with a separate test database), not a mock, so Docker must be running to run them. Manual checks go in `docs/DEMO.md` as a checklist, and the `/final` command re-runs the live ones.

| Check | Requirements | Why it isn't automated | How it's done |
|---|---|---|---|
| Dashboard behaviour: key prompt, sample-data button, files load, banner and severity badges show, reload asks for the key again and History opens | FR-14, FR-21, FR-27, FR-18, FR-19, NFR-S6 | Component tests need jsdom and Testing Library, which are extra dev dependencies plus setup time. The source-scan tests in `tests/security.test.js` cover the storage and HTML rules in the code. | Walk through the checklist in the browser |
| Deployment exposure: only port 3000 answers from outside, the database port doesn't, and the unencrypted-HTTP notice is visible | NFR-S7 | Needs the real EC2 host and its security group | Open `http://<EC2 public IP>:3000`, check the banner, and try ports 27017 and 22 from another machine |
| Restart after a crash or reboot; saved results still there | NFR-R7, NFR-R10 | Needs the real host and real volumes | `docker kill` each container, reboot, then list results |
| Expiry actually deletes records | NFR-P5 | MongoDB's TTL cleaner runs about once a minute in its own process. The test checks that the index and the date are set. | Once, with `RETENTION_DAYS` set very low on a test instance |
| No outside calls, short dependency list | NFR-S4 | Proving that nothing calls out needs a running browser or network capture | Review `package.json`, grep the built files for external URLs, and check the browser network tab in the demo |
| Live URL main flow, no secrets in files or history | (submission) | Needs the deployed system | `/final`: `curl` the URL with the seed data, then grep files and git history |

## 5. Not in this document

Things left out on purpose, with reasons, are in `docs/DECISIONS.md` under "Consciously leaving out". Open assumptions are in `docs/ASSUMPTIONS.md`.
