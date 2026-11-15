# Requirements

Sources: `case/brief.md`, `docs/PROBLEM.md`, `docs/ASSUMPTIONS.md` (IDs such as B1 and D3), and the Decision log in `docs/DECISIONS.md` ("Decision N"). The brief is incomplete on purpose, so many requirements rest on **unconfirmed assumptions**. Where one does, its ID is cited. None of them is a confirmed customer requirement.

**Mandatory stack (set by the user):** React + Vite, Node.js + Express, MongoDB with Mongoose, Docker and Docker Compose, AWS EC2. The demo is served over plain HTTP (no HTTPS), with fictional data and public demo passwords.

**Priority:** Must = in the first build. Should = built if time is left after the Musts. Could = only if everything else is done.
**Status:** `planned` → `implemented` (code exists) → `verified` (tests were run and passed, output seen). The first build covers the Must items only.

## Current status (updated at Milestone 7)

Built and verified locally with Docker Compose: the six rules, JWT login for two roles, saved history in MongoDB, the employee schedule, the React portal. **Not deployed to EC2 in this version** (the instance runs the earlier shared-key, no-database build). `verified` below means the automated tests were run and passed (285 tests, 12 suites); where something was also run against the real Compose stack, that is said. Browser behaviour is **not** verified by a human yet (`docs/DEMO.md`).

Priorities still read: Must, Should, Could. Requirements FR-28 to FR-34 and the history routes (`/api/history`) were added after the first plan, and **FR-26 (delete) was built**. Not built: FR-15, FR-18, FR-19, FR-20, FR-22, NFR-R11, NFR-F1 (no timing test).

## 1. Functional requirements

### Must (first build)

| ID | Requirement | Source |
|---|---|---|
| FR-01 | `POST /api/check` (manager only) accepts employees, shifts and leave as CSV text inside a JSON body, runs the check, saves the outcome (FR-23) and returns it. If the account is verified but saving fails, it still returns the findings with `saved: false`. | Decision 3, D1, Decision 12 |
| FR-02 | CSV parsing is hand-written. Rows are validated (field count, IDs, date and time format). Quoted commas are not supported, and the README says so. A bad row is reported and skipped. It never stops the check. | Decision 1, D4, D5 |
| FR-03 | A missing or malformed date or time is reported as a data finding. Seed example: SH086. | D4, D5 |
| FR-04 | An exact duplicate row is reported once as a duplicate and left out of the other rules, so it never counts as an overlap. Seed example: SH091. | D3 |
| FR-05 | Two overlapping shifts for one person at the same store are a finding. Every overlapping pair is reported, including nested shifts (one fully inside another) and three or more shifts that overlap together. Reporting stops at `MAX_FINDINGS` (my assumption: 1000), and the summary then says `truncated: true`, so it is never silent. Seed example: SH024 and SH025. | B1 |
| FR-06 | Two overlapping shifts for one person at different stores are a finding that names both stores. Seed example: SH033 and SH041. | B1, U4 |
| FR-07 | Touching shifts (one ends when the next starts) are not an overlap. | Decision 4 |
| FR-08 | A shift on a day of approved leave is a finding. Only `approved` leave counts. Leave runs from `start_date` to `end_date`, both included. Seed example: SH098. | D7, D8 |
| FR-09 | Less than 11h between the end of one shift and the start of the next is a finding. Exactly 11h is allowed. Seed example: SH013 and SH021. | B3, Decision 4 |
| FR-10 | Each finding has a rule ID, a severity, the employee ID, the shift IDs involved and a plain-language message. | PROBLEM.md success measures |
| FR-11 | The response has a summary: finding counts per rule, the number of rows skipped, `truncated`, and a clear or not-clear flag. It also says whether the result was saved (`saved`, `resultId`). `saved` is `true` only after everything was written; it is `false` and `resultId` is `null` if saving failed. It is advisory only and never blocks anything. | B2 |
| FR-12 | An unknown employee ID or store ID in a shift or leave row is reported, and the run continues. | D9 |
| FR-13 | Every `/api` request except login needs a valid JWT in `Authorization: Bearer <token>`, or it is rejected with 401. The token is checked before the body is read, so an anonymous caller learns nothing about validation. (Replaces the shared `ACCESS_KEY`, Decision 13.) | Decision 13, S2 |
| FR-14 | The React portal offers Manager Login and Employee Login. The manager portal loads the 3 CSV files, sends them to the API, and shows the result: a red (problems found) or green (clear) summary banner, each finding as a row in a table with a severity badge, readable IDs, times and messages. The token is never part of the frontend source or build and is held in memory only (NFR-S2, NFR-S6). | Decision 13, Decision 5, Decision 11 |
| FR-21 | The dashboard has a sample-data button that loads the three seed files (employees, shifts, leave) in one click, so the demo needs no file picking. | Decision 11 |
| FR-23 | Each completed check is saved in MongoDB through Mongoose: the roster rows that passed validation (IDs, stores, dates, times, leave ranges, **no names**), the validation result and its findings, written roster, findings, result last, with cleanup if a step fails. | Decision 7, D10, S1, Decision 12 |
| FR-24 | `GET /api/history?page=&limit=` (manager) lists saved results, newest first, with their summaries. `limit` is capped at 100; bad values give 400. | Decision 7, Decision 12 |
| FR-25 | `GET /api/history/:id` (manager) returns one saved result with its findings in the original order and the roster row counts. An unknown or expired ID gives 404, a malformed ID 400. | Decision 7, Decision 12 |
| FR-27 | The manager portal has a Roster History list (paginated) of earlier saved results; one can be reopened and deleted. If the API says history is unavailable (503), the portal says so and offers a retry. | Decision 12 |
| FR-28 | `POST /api/auth/login` takes a username and password and returns a signed JWT (HS256, `JWT_SECRET` of 32+ characters, `JWT_EXPIRES_IN`). Wrong password, unknown user and inactive account give the same 401. `GET /api/auth/me` and `POST /api/auth/logout` exist; a logged-out token stops working. | Decision 13, S2 |
| FR-29 | Two roles. **Manager** (username `manager`, password from `MANAGER_PASSWORD`, stored as a bcrypt hash, never overwritten on restart): check, history, delete. **Employee** (username = employee ID): `GET /api/me/schedule` only. The server returns 403 for the other role's routes. | Decision 13, U2, U3 |
| FR-30 | `GET /api/me/schedule` returns only the caller's own shifts, leave and findings from the latest saved check. The employee ID comes from the verified token, never from the URL, query or body. With no saved roster it returns 200 with `hasRoster: false`. | U3, A3 |
| FR-31 | The Employee Portal shows the employee's shifts, leave and problems, with loading, error and empty states, and a Logout button. The manager and employee screens are protected: a screen is shown only to the matching role. | U3 |
| FR-32 | Employee accounts are created once from `employees.csv` by `server/seed.js`, each with a unique random password. Existing accounts are never touched, so passwords are not regenerated. New passwords go to a git-ignored `credentials.txt` (mode 600) and never to logs or APIs. | A2 |
| FR-33 | **Fail closed.** Every protected request verifies the account in MongoDB (exists, active, role unchanged). If that cannot be done the answer is 503 `AUTH_UNAVAILABLE`; a valid signature alone is never enough. | A6 |
| FR-34 | Docker Compose runs the app and an authenticated MongoDB with a named volume, an internal private network and no published database port; the app starts only after MongoDB is healthy. | Decision 8, NFR-S7 |

### Should

| ID | Requirement | Source |
|---|---|---|
| FR-15 | Each finding carries a **deterministic fix hint** made from a fixed template per rule (no AI), for example "Move one of the shifts, or end the first before the second starts." The hint is an added field. Findings, the summary, the API and the Must tests are complete without it, and a missing or failing hint step never changes or removes a finding. | PROBLEM.md F7 |
| FR-16 | On the seed data the checker returns exactly the 6 planted problems and nothing else: **zero false positives** (answer key: `case/seed/README.md`). | PROBLEM.md success measures |
| FR-17 | The result doesn't depend on the order of the rows. | D1, ASSUMPTIONS edge cases |
| FR-18 | The dashboard can filter findings by rule or severity. | Decision 5 |
| FR-19 | The dashboard can download the findings as a JSON file. | I3 |
| FR-26 | `DELETE /api/history/:id` (manager) deletes a saved result with its findings and roster. The result is removed first so it disappears from the API at once. | S1 |

### Could

| ID | Requirement | Source |
|---|---|---|
| FR-20 | **Optional AI explanation.** The rules decide every finding. AI only rewrites the explanation text for findings that already exist. It must never create, remove, modify or influence findings. It is off by default (`AI_MODE=off`). Only IDs, times and rule names are sent, never names. There is a 10s timeout and a fallback to the fixed template text. No chat, summaries, prioritisation, recommendations or any other AI function. | Decision 6, I4 |
| FR-22 | The minimum rest hours and the leave statuses that count are set by environment variables. | O4, D7 |

## 2. Non-functional requirements

### Security

| ID | Requirement | Source |
|---|---|---|
| NFR-S1 | Passwords are stored only as bcrypt hashes. Passwords, hashes, tokens and the JWT secret are never logged and never returned in any response, including error responses. Wrong username and wrong password are indistinguishable. | Decision 13 |
| NFR-S2 | No secrets in code or git. `JWT_SECRET` and the database credentials are environment variables, never in the frontend source or build (no `VITE_` variable). `.env.example` is committed with placeholders; `.env`, `credentials.txt` and `secrets/` are not. | CLAUDE.md, Decision 13 |
| NFR-S3 | Request size is limited and every field is validated before use. Uploaded text is untrusted. No request value is put into a database query as an object, and result IDs are checked to be valid before use. | S3 |
| NFR-S4 | The app makes no outside calls (no CDN scripts, fonts or analytics). The dependency list is short and stated in the README. | I2 |
| NFR-S5 | The dashboard shows findings as text, never as raw HTML. | S3 |
| NFR-S6 | The token and session are kept in frontend memory only. They are never written to `localStorage`, `sessionStorage`, cookies or the URL, so a page reload asks for a login again. The password field is cleared after it is sent. | Decision 13 |
| NFR-S7 | The demo is served over **plain HTTP**, and says so: the README and every screen show "Demo over unencrypted HTTP. Use fictional data only." Only the application port (3000) is published, SSH is open only from the user's IP, and the MongoDB port is never published (no `ports:` entry, internal network). | Decision 9 |
| NFR-S8 | Database credentials exist only in server-side environment variables. The app builds its connection string and URL-encodes them. They are never in frontend code, API responses or logs. Connection errors are logged by error name only. | Decision 7 |

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
| NFR-R2 | `GET /health` returns `{"status":"ok"}` while the Node process is up. **It does not check MongoDB** (a `db` field was planned and not built). Database reachability is shown by login or any protected call returning 503 `AUTH_UNAVAILABLE`. | CLAUDE.md |
| NFR-R3 | Logging is structured (JSON lines), with no personal data. | CLAUDE.md, O3 |
| NFR-R4 | The same input always gives the same output, in the same order. | PROBLEM.md N1 |
| NFR-R5 | If AI is on and fails or times out, the template text is used and the findings are unchanged. | Decision 6 |
| NFR-R6 | All configuration comes from environment variables, including the MongoDB connection. | CLAUDE.md |
| NFR-R7 | All containers restart after a crash or a reboot. | O1, O2 |
| NFR-R8 | Every requirement that can practically be tested from code has an automated test (Jest and Supertest), and tests run before each commit. The few that can't are listed in section 4 as manual checks, each with the reason. | CLAUDE.md |
| NFR-R9 | If MongoDB is down, login and every protected request return 503 `AUTH_UNAVAILABLE` (fail closed, FR-33). If the account is verified but a database write fails, `POST /api/check` still returns the findings with `saved: false` and cleans up partial writes. History routes return 503 `HISTORY_UNAVAILABLE` when only the data read fails. The app starts, serves `/health`, and keeps retrying the connection. | Decision 7, A6 |
| NFR-R10 | Saved results and accounts survive a container restart and recreation (MongoDB data is on the named volume `mongo_data`; a second named volume holds MongoDB's config). | Decision 8 |
| NFR-R11 | **(Should)** A GitHub Actions workflow runs the automated tests on every push. | Decision 11 |

## 3. Traceability

Paths are real. Status words: `verified` = automated test run and passed (285 tests); "stack" = also run against the real Docker Compose stack on 2026-11-16 (local only, not EC2); "EC2 (earlier build)" = checked on the instance on 2026-11-15, before login and MongoDB existed. Items without an automated test are marked "manual" and explained in section 4.

| Req ID | Requirement | Priority | Feature or endpoint | File | Test | Status |
|---|---|---|---|---|---|---|
| FR-01 | Accept CSV text in a JSON body, check, save, return | Must | `POST /api/check` | `app/server/routes/check.js`, `app/server/store.js` | `app/tests/api.test.js`, `app/tests/history.test.js` | verified (stack) |
| FR-02 | Hand-written CSV parse and row validation | Must | CSV parser | `app/server/parse/csv.js` | `app/tests/parse.test.js` | verified |
| FR-03 | Missing or malformed date or time reported | Must | Rule `DATA_BAD_ROW` | `app/server/parse/validate.js` | `app/tests/parse.test.js` | verified |
| FR-04 | Exact duplicate reported once, excluded from other rules | Must | Rule `DUPLICATE_ROW` | `app/server/rules/duplicate.js` | `app/tests/rules.test.js` | verified |
| FR-05 | Same-store overlap; all pairs incl. nested and 3-way; truncation flag | Must | Rule `OVERLAP` | `app/server/rules/overlap.js` | `app/tests/rules.test.js` (seed pair, nested, 3-way, cap) | verified |
| FR-06 | Cross-store overlap names both stores | Must | Rule `OVERLAP` (cross-store) | `app/server/rules/overlap.js` | `app/tests/rules.test.js` | verified |
| FR-07 | Touching shifts are not an overlap | Must | Rule `OVERLAP` boundary | `app/server/rules/overlap.js` | `app/tests/rules.test.js` (end = start) | verified |
| FR-08 | Shift on approved leave | Must | Rule `ON_LEAVE` | `app/server/rules/leave.js` | `app/tests/rules.test.js` | verified |
| FR-09 | Under 11h rest; exactly 11h allowed | Must | Rule `SHORT_REST` | `app/server/rules/rest.js` | `app/tests/rules.test.js` | verified |
| FR-10 | Finding fields: rule, severity, employee, shifts, message | Must | Response `findings[]` | `app/server/rules/index.js` | `app/tests/api.test.js` | verified |
| FR-11 | Summary with counts, skipped rows, truncated, clear, saved | Must | Response `summary`, `saved`, `resultId` | `app/server/routes/check.js` | `app/tests/api.test.js`, `app/tests/history.test.js` (saved only after full write; false after each partial failure) | verified |
| FR-12 | Unknown employee or store ID reported | Must | Rule `UNKNOWN_REF` | `app/server/parse/validate.js` | `app/tests/parse.test.js` | verified |
| FR-13 | JWT required on every `/api` route except login; checked before the body | Must | Auth middleware | `app/server/auth.js`, `app/server/index.js` | `app/tests/api.test.js`, `app/tests/auth.test.js` (missing, malformed, forged, wrong secret, alg none, HS512, edited payload, expired, logged out, deleted user, role mismatch) | verified (replaces the shared key; EC2 shows the old key check only) |
| FR-14 | FreshMart portal: two logins, manager upload, status bar, findings table | Must | Single-page UI | `app/client/src/` (`App`, `Screens`, `Portal`, `Dashboard`, `Upload`, `Results`, `History`, `api.js`, `session.js`) | `app/tests/ui.test.js` (rendered screens, login logic), `app/tests/describe.test.js`, `app/tests/security.test.js` (source scan); manual (docs/DEMO.md section A) | implemented; rendering tested; **not clicked through in a browser** |
| FR-15 | Deterministic fix hints | Should | Hint templates | `app/server/rules/hints.js` | `app/tests/hints.test.js` | planned |
| FR-16 | Seed data gives exactly the 6 planted problems, no false positives | Should | Seed run | `case/seed/` | `app/tests/seed.test.js` (exactly 6 findings through the API) | verified (tests pass; live on EC2: the same 6 findings, 2026-11-15) |
| FR-17 | Result independent of row order | Should | Sorting in rules | `app/server/rules/index.js` | `app/tests/rules.test.js` | verified |
| FR-18 | Dashboard filter by rule or severity | Should | Results filter | `app/client/src/App.jsx` | manual | planned |
| FR-19 | Dashboard download findings as JSON | Should | Download button | `app/client/src/App.jsx` | manual | planned |
| FR-20 | Optional AI explanation, off by default | Could | Explain step, `AI_MODE` | `app/server/explain.js` | `app/tests/explain.test.js` | planned |
| FR-21 | Dashboard sample-data button loads the seed files in one click | Must | Sample button | `app/client/src/App.jsx` | manual (demo checklist) | implemented |
| FR-22 | Rest hours and leave statuses by env var | Could | Config | `app/server/config.js` | `app/tests/config.test.js` | planned |
| FR-23 | Save roster rows (no names), result and findings | Must | Persistence in `POST /api/check` | `app/server/store.js`, `app/server/models/*.js` | `app/tests/history.test.js` (round trip, no names, order, cleanup after each failing step), `app/tests/db.test.js` | verified (stack) |
| FR-24 | List saved results, newest first, paginated | Must | `GET /api/history` | `app/server/routes/history.js` | `app/tests/history.test.js` (pages, cap at 100, bad queries) | verified |
| FR-25 | Open one saved result; 404 if missing, 400 if malformed | Must | `GET /api/history/:id` | `app/server/routes/history.js` | `app/tests/history.test.js` | verified (stack) |
| FR-26 | Delete a saved result with its findings and roster | Should | `DELETE /api/history/:id` | `app/server/routes/history.js`, `app/server/store.js` | `app/tests/history.test.js` (only that result removed; twice gives 404; cleanup failure) | verified |
| FR-27 | Manager History list; reopen and delete | Must | History screen | `app/client/src/History.jsx` | `app/tests/ui.test.js` (loading, error, empty, page of results); manual | implemented; not clicked through in a browser |
| FR-28 | Login, me, logout with JWT | Must | `/api/auth/*` | `app/server/routes/auth.js`, `app/server/auth.js` | `app/tests/auth.test.js` (both roles, wrong/unknown/inactive, injection-style bodies, size limit, no secrets in logs) | verified (stack) |
| FR-29 | Manager and employee roles; bcrypt; manager never overwritten | Must | Role middleware, `ensureManager` | `app/server/auth.js`, `app/server/seed.js`, `app/server/server.js` | `app/tests/auth.test.js` (403 matrix, nothing saved or deleted), `app/tests/db.test.js` (hashes, restart keeps hash) | verified (stack) |
| FR-30 | Employee sees only own data from the latest roster | Must | `GET /api/me/schedule` | `app/server/routes/me.js`, `app/server/store.js` | `app/tests/auth.test.js` (isolation per employee, ID cannot be chosen via query, header, URL or body, no roster, fallback after delete, leave isolation) | verified (stack) |
| FR-31 | Employee Portal and protected screens | Must | Employee screen, `allowedScreen` | `app/client/src/EmployeePortal.jsx`, `app/client/src/session.js` | `app/tests/ui.test.js` (shifts, leave, findings, empty, loading, error, escaping, protected routes); manual | implemented; not clicked through in a browser |
| FR-32 | Employee accounts seeded once with random passwords | Must | `server/seed.js` | `app/server/seed.js` | `app/tests/db.test.js` (unique passwords, file contents, re-run changes nothing, no plaintext in logs or database) | verified (stack: 25 accounts via bind mounts) |
| FR-33 | Fail closed when the account cannot be verified | Must | `requireAuth` | `app/server/auth.js` | `app/tests/auth.test.js`, `app/tests/history.test.js` (503 for login, check, history, me, logout with a valid token) | verified (stack: mongo stopped, then restarted) |
| FR-34 | Compose: app + authenticated private MongoDB | Must | `docker-compose.yml` | `docker-compose.yml`, `Dockerfile`, `.env.example` | `app/tests/compose.test.js` (no port, internal network, volumes, required variables); run on the real stack | verified (stack); not on EC2 |
| NFR-S1 | Passwords hashed with bcrypt; no password, hash, token or secret logged or returned | Must | Auth, seed, logger | `app/server/auth.js`, `app/server/seed.js` | `app/tests/auth.test.js`, `app/tests/db.test.js`, `app/tests/api.test.js` (captured logs and 401, 500 bodies) | verified (stack: 296 log lines scanned) |
| NFR-S2 | No secrets in code or git; none in frontend source or build | Must | `.env.example`, `.gitignore`, Vite build | `.env.example`, `app/client/` | `app/tests/security.test.js` (no `ACCESS_KEY` or `VITE_` use; built files contain no `JWT_SECRET` or Mongo password from the environment or `.env`), `app/tests/compose.test.js` | verified |
| NFR-S3 | Size limit, validation, safe IDs in queries | Must | Body limit, validation | `app/server/index.js`, `app/server/routes/history.js`, `app/server/routes/auth.js` | `app/tests/api.test.js`, `app/tests/history.test.js` (bad IDs, object injection in query and login) , `app/tests/auth.test.js` | verified |
| NFR-S4 | No outside calls, short dependency list | Must | Whole app | `app/package.json` | `app/tests/security.test.js` (no URLs in source, short client dependency list) + manual network-tab check | implemented |
| NFR-S5 | Findings shown as text, not HTML | Must | React rendering | `app/client/src/` (`App`, `Screens`, `Portal`, `Dashboard`, `Upload`, `Results`) | `app/tests/security.test.js` (no `dangerouslySetInnerHTML`) + manual | implemented |
| NFR-S6 | Token in frontend memory only; no token in a URL; password cleared after sending | Must | React state, `api.js` | `app/client/src/App.jsx`, `app/client/src/api.js` | `app/tests/security.test.js` (no `localStorage`, `sessionStorage`, `document.cookie`; token only in the header; `fetch` only in `api.js`) + manual reload check | implemented; source-scanned; manual check not run |
| NFR-S7 | HTTP-only demo notice on every screen; only the app port published; Mongo port never published | Must | Compose `ports`, footer, README | `docker-compose.yml`, `app/client/src/App.jsx`, `README.md` | `app/tests/notice.test.js` (text, one footer around every screen, contrast), `app/tests/ui.test.js` (footer on six screens), `app/tests/compose.test.js` | verified in the stack: `mongo` shows `27017/tcp` unpublished, nothing answered on the host's LAN addresses (a MongoDB on the host itself answered on 127.0.0.1, unrelated). EC2 (earlier build, 2026-11-15): 3000 answered, 27017 did not. **Not re-checked on EC2 for this version.** SSH rule sources were never checked. |
| NFR-S8 | DB credentials only server-side, URL-encoded, never in responses or logs | Must | Config, db.js, logger | `app/server/db.js`, `app/server/auth.js` | `app/tests/db.test.js` (URI encoding, failed connection logs name only), `app/tests/auth.test.js` (driver error text never logged or returned) | verified (stack: password `Zq7@x:/#y%9` connected) |
| NFR-P1 | No names in logs | Must | Logger | `app/server/logger.js` | `app/tests/api.test.js` (request and 500 logs contain no key or names) | verified |
| NFR-P2 | Minimal stored data, no names, roles or hours | Must | Mongoose schemas | `app/server/models/*.js` | `app/tests/db.test.js`, `app/tests/history.test.js` (stored documents contain no name, role or hours) | verified |
| NFR-P3 | No names sent to AI | Could | Explain payload | `app/server/explain.js` | `app/tests/explain.test.js` | planned |
| NFR-P4 | IDs only in the dashboard | Must | Response shape | `app/server/rules/index.js` | `app/tests/api.test.js` | verified |
| NFR-P5 | Expiry on every stored roster, result and finding (not on accounts) | Must | TTL index on `createdAt` | `app/server/models/*.js` | `app/tests/db.test.js` (TTL index exists with `RETENTION_DAYS` x 86400 seconds on all three) | implemented; index verified; **deletion by expiry not observed** (manual, section 4) |
| NFR-F1 | ~150 shifts in under 2s, including saving | Must | Whole check | `app/server/routes/check.js` | `app/tests/perf.test.js` | planned |
| NFR-F2 | Sweep-line overlap, O(n log n + k) | Must | Group, sort, active set | `app/server/rules/overlap.js` | `app/tests/rules.test.js` (nested, 3-way, touching, same-start, cap) + `app/tests/perf.test.js` | implemented |
| NFR-F3 | Request size limit | Must | Body parser limit | `app/server/index.js` | `app/tests/api.test.js` | verified |
| NFR-R1 | Bad input returns a clear 4xx, no crash | Must | Error handler | `app/server/index.js` | `app/tests/api.test.js` | verified |
| NFR-R2 | `GET /health` is process liveness only; does not check MongoDB | Must | Health route | `app/server/index.js` | `app/tests/api.test.js` (200 without a token; also 200 while the database is down) | verified (EC2 earlier build and stack). The `db` field was not built. |
| NFR-R3 | Structured logging | Must | Logger | `app/server/logger.js` | `app/tests/api.test.js` | verified |
| NFR-R4 | Same input, same output and order | Must | Whole check | `app/server/rules/index.js` | `app/tests/rules.test.js` | verified |
| NFR-R5 | AI failure falls back to template | Could | Explain step | `app/server/explain.js` | `app/tests/explain.test.js` | planned |
| NFR-R6 | Config from env vars only | Must | Config | `app/server/config.js` | `app/tests/api.test.js` (config describe block) | verified |
| NFR-R7 | Containers restart | Must | Compose restart policy | `docker-compose.yml` | manual (deploy check) | verified for a crash (live on EC2, 2026-11-15: `kill -9` of the app process, container restarted, `restarts=1`, healthy). Not restarted by `docker kill` (manual stop). Reboot not tested. |
| NFR-R8 | A test per testable requirement, run before each commit; manual checks listed with reasons | Must | Test suite | `app/tests/` | this table and section 4 | implemented: 285 tests in 12 suites, run before each commit. Manual checks are listed in section 4; UI behaviour in a browser is not covered by a test |
| NFR-R9 | Database failure: fail closed; saved:false only when the account is verified and the save fails | Must | `requireAuth`, store, history routes | `app/server/auth.js`, `app/server/store.js`, `app/server/routes/*.js` | `app/tests/auth.test.js`, `app/tests/history.test.js` (outage, mid-request loss, each failing write step) | verified (stack outage test) |
| NFR-R10 | Data survives restart and recreation | Must | Named volumes for MongoDB | `docker-compose.yml` | `app/tests/compose.test.js` (volumes declared); run on the real stack: `restart app`, then `down` and `up` (no `-v`) | verified (stack); not on EC2; host reboot not tested |
| NFR-R12 | Manual backup and restore of the database | Should | `mongodump` and `mongorestore` through `docker compose exec` | `README.md`, `docs/DEPLOY.md` | manual (section 4) | verified once on the stack: 34 documents dumped, database dropped, 34 restored, logins and history worked; not on EC2 |
| NFR-R11 | Tests run on every push | Should | GitHub Actions workflow | `.github/workflows/test.yml` | the workflow run itself (green check on GitHub) | planned |

## 4. Manual checks and why

Everything not listed here has an automated test in the table above. Database tests run against a real MongoDB (the Compose `mongo` service, with a separate test database), not a mock, so Docker must be running to run them. Manual checks go in `docs/DEMO.md` as a checklist, and the `/final` command re-runs the live ones.

| Check | Requirements | Why it isn't automated | How it's done |
|---|---|---|---|
| Browser behaviour: both logins, protected screens, history list and delete, employee portal, reload signs out, sample-data button, banner and severity badges | FR-14, FR-21, FR-27, FR-31, NFR-S6 | Component tests in a real browser engine need jsdom and Testing Library, extra dev dependencies the project does not have. `app/tests/ui.test.js` renders the real components to HTML and tests the logic, but cannot click, type or follow a login; the source scans in `security.test.js` cover the storage and HTML rules. | Walk through the checklist in `docs/DEMO.md` (**not yet run**) |
| Deployment exposure: only port 3000 answers from outside, the database port doesn't, and the unencrypted-HTTP notice is visible | NFR-S7 | Needs the real EC2 host and its security group | Open `http://<EC2 public IP>:3000`, check the banner, and try ports 27017 and 22 from another machine |
| Restart after a crash or reboot; saved results still there | NFR-R7, NFR-R10 | Needs the real host and real volumes | Kill each app process with `kill -9` from the host (`docker kill` is a manual stop and is not restarted), reboot, then list results |
| Expiry actually deletes records | NFR-P5 | MongoDB's TTL cleaner runs about once a minute in its own process. The test checks that the index and the date are set. | Once, with `RETENTION_DAYS` set very low on a test instance |
| No outside calls, short dependency list | NFR-S4 | Proving that nothing calls out needs a running browser or network capture | Review `package.json`, grep the built files for external URLs, and check the browser network tab in the demo |
| Live URL main flow, no secrets in files or history | (submission) | Needs the deployed system | `/final`: `curl` the URL with the seed data, then grep files and git history |

## 5. Not in this document

Things left out on purpose, with reasons, are in `docs/DECISIONS.md` under "Consciously leaving out". Open assumptions are in `docs/ASSUMPTIONS.md`.
