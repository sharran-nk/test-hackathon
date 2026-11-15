# Decisions

## Decision log

Decided by the user. Decisions 1 to 6 are kept exactly as recorded. Decisions 7 to 10 record the mandatory stack and the algorithm that were settled later. If any section below ever conflicts with this log, the log wins.

| # | Decision | Reason |
|---|---|---|
| 1 | **CSV parsing:** hand-written, no dependency. The README will say quoted commas are not supported. | The seed data has no quoted commas. No extra dependency, and the parsing is easy to explain. The limit is stated openly. |
| 2 | **Access:** a shared key from the `ACCESS_KEY` env var, sent as a header. The page asks for it once. | The URL is public, so some gate is needed. This is the smallest one, with no user accounts. |
| 3 | **Input:** the page sends CSV text as JSON to `POST /api/check`. | No file-upload package is needed. The server receives text it can validate and size-limit. |
| 4 | **Touching shifts are not an overlap. Exactly 11h rest is allowed.** | A shift ending at 14:00 followed by one starting at 14:00 is a normal handover. Only less than 11h is a rest breach. These rules decide the boundary tests. |
| 5 | **Front end:** React + Vite instead of a static page. Still approach A: stateless, no database, no login. Express serves the built React app. One Docker image, multi-stage build. | The demo must look presentable. The architecture doesn't change, since the rules engine and API are the same. React and Vite are in the stack the user already knows, and the multi-stage build keeps it to one image. |
| 6 | **AI:** optional and explain-only. Rules decide every finding. AI only rewrites the explanation text. Off by default (`AI_MODE=off`). Only IDs, times and rule names are sent, never names. 10s timeout and a template fallback. | AI is a bonus, never a gate, and the app must work without it. Sending no names keeps personal data out (S1). The timeout and fallback mean a slow or missing model can't break a check. |
| 7 | **Persistence:** MongoDB with Mongoose is mandatory. Each check is saved (roster rows, result, findings) and can be listed and reopened. **Supersedes the "stateless, no database" wording in Decision 5** and the stateless premise of the first version of approach A. Everything else in Decision 5 stands. Stored data is IDs, stores, dates, times and findings, never names, and expires after 30 days (assumption). | The user's mandatory stack, and the challenge needs previous results to be retrievable. Keeping names out and adding an expiry limits what is stored (S1). |
| 8 | **MongoDB runs as a container in Docker Compose on the same EC2 instance**, not on MongoDB Atlas. | Fastest to set up (one more service, no account, cluster or IP allow-list), nothing published to the internet, no third-party service, data stays on our instance. The cost is no managed backups and one disk, which is acceptable because the data expires after 30 days and can be re-uploaded. Details in `docs/ARCHITECTURE_FULL.md` section 9. |
| 9 | **No Caddy and no HTTPS.** The demo is served over plain HTTP at the EC2 public IP and the application port (3000). Express serves the React build and the API from one container. Only the application port is published, and MongoDB's port is never published. The README and the dashboard say it is unencrypted and for fictional data and a temporary access key only. **This replaces the earlier plan to put Caddy with Let's Encrypt in front of the app.** | The user doesn't want Caddy or HTTPS. It removes the domain, DNS and certificate work and one container. The cost is that the key and the roster data cross the network unencrypted, which is acceptable only for a short demo with fictional data. |
| 10 | **Overlap detection:** a sweep-line over each person's sorted shifts with an active list. Expired shifts (end at or before the new start) are dropped, then the new shift is paired with every active one. Cost O(n log n + k), where k is the number of overlapping pairs. Reporting stops at `MAX_FINDINGS` (assumption: 1000), and the summary then says `truncated`. | It finds every overlapping pair, including nested and three-way overlaps, which a neighbour-only comparison misses. The limit stops a pathological roster from producing n squared findings. The proof of the bound is in `docs/ARCHITECTURE_FULL.md` section 8. |
| 11 | **Delivery order.** The first build is **stateless**: `POST /api/check` returns findings without saving, and Compose has only the `app` service. MongoDB persistence (FR-23, FR-24, FR-25, the dashboard History list FR-27, the `mongo` service and the database tests) is a Should, built only after the app is deployed and working. The sample-data button (FR-21) moves from Could to Must. A GitHub Actions workflow that runs the tests on every push is a Should. Time is added for a presentable dashboard: red or green summary banner, severity badges and a readable findings table. Decisions 7 and 8 still say what persistence will look like. **The persistence part of Decision 11 is superseded by Decision 12.** The rest of Decision 11 stands. | A deployed, working and presentable app comes first, and persistence is the part most likely to overrun. The cost: if there is no time for persistence, the saved-results requirement is not met, and the earlier "MongoDB is mandatory" item is only a plan. |
| 12 | **MongoDB history is a Must in the first build again.** FR-23, FR-24, FR-25 and the dashboard History list (FR-27) are Must, and the architecture diagram shows MongoDB in the first build. **Build order protects the deadline:** milestone 1 rules and `POST /api/check`, tested locally with no database; milestone 2 React dashboard with the sample-data button; milestone 3 deploy to EC2 with only the `app` service and check the live URL; milestone 4 add MongoDB (models, saving, history routes, `mongo` service in Compose, database tests) and redeploy. If time runs out before milestone 4, the app still works with `saved: false` and the History list marked unavailable. GitHub Actions (NFR-R11), the delete route (FR-26) and the dashboard filters (FR-18) are Should. The plan stays at 150 minutes, with the time taken from dashboard polish and non-critical tests, not from the rules. | The dashboard needs saved results, and MongoDB is part of the user's stack. Putting MongoDB last in the build order means a late finish costs only history, not the checker. |
| 13 | **Authentication: JWT with username and password and two roles, replacing the shared `ACCESS_KEY` (supersedes Decision 2).** Manager (`manager`, password from `MANAGER_PASSWORD`) and employees (username = employee ID, random password from a seed script), bcrypt hashes in MongoDB, HS256 tokens from `JWT_SECRET`, roles enforced on the server. Tokens live in React memory only. | One shared key cannot separate a manager from an employee or let an employee see only their own data. JWT and bcrypt are in the user's stack. The cost: a database for accounts, and a weak public demo password. |
| 14 | **Fail closed.** Every protected request verifies the account in MongoDB, and returns 503 if it cannot. A valid token alone is not trusted during an outage. Supersedes the earlier idea that checking keeps working with `saved: false` when MongoDB is down; that now holds only when the account was verified and the save fails. | A deactivated or deleted account must stop working at once, and a signature cannot be revoked. The cost: a database outage stops the whole tool, including the checker. |
| 15 | **Compose: MongoDB 7 on an internal network, no published port, named volumes, app builds the URI itself.** Credentials arrive as required variables; the app URL-encodes them because Compose cannot. The app uses the MongoDB root user (a least-privilege user is not done). | Keeps the database private and the setup short. Cost: root access from the app, one disk, manual backups. Changing the MongoDB credentials later does not change an existing user. |

Inputs: `docs/PROBLEM.md`, `docs/ASSUMPTIONS.md` (IDs like B1 and D3 refer to it), CLAUDE.md. All assumptions are **unconfirmed**. This file is the decision record, so later changes need a reason added here.

**Refinements since the first version (the decisions above are unchanged):** Decision 2 is detailed as `Authorization: Bearer <key>`, typed by the user and held in frontend memory only, so a reload asks again. The key is never in the frontend source or build, never in browser storage, and never logged or returned.

## The three approaches

All three use the mandatory stack. They differ in what is built on top of it.

### A. Checker with persistence

**Architecture**
1. React + Vite dashboard (Decision 5). It reads the 3 CSV files in the browser and sends their text as JSON to `POST /api/check`. It also lists and reopens saved results.
2. Express app: checks the key, validates the request, calls the rules engine, saves the outcome, returns it. Serves the built React files, `GET /health` and the results routes.
3. Rules engine: a plain module with no HTTP or database code. Steps: parse and validate rows, drop exact duplicates, then overlap (sweep-line), rest and leave checks on the valid rows.
4. MongoDB with Mongoose, in a container: three collections (rosters, validation results, findings), no names, 30-day expiry (Decisions 7, 8).
5. Docker Compose on one AWS EC2 box: the app image we build, plus a stock `mongo` image (added at milestone 4). Plain HTTP on port 3000 (Decision 9).

**Tech:** Node.js, Express, Mongoose, React, Vite, Jest, Supertest, Docker. No user accounts.
**Pros:** covers every mandatory item with the smallest design. Most of the time goes into correctness. A small data model that holds no names. A presentable UI.
**Cons:** one shared key is the only gate, no per-user history, and the database is one container on one disk with no backups.
**Build time:** 150 minutes, with no spare buffer (milestones and split below). MongoDB is milestone 4 and is the first thing to give up if time runs out.
**Security:** key check, input limits, strict validation, IDs only in logs, credentials only in server environment variables, MongoDB not published, and the app is served over unencrypted HTTP (fictional data and a temporary key only).
**Scaling:** the overlap check is O(n log n + k), where k is the number of overlapping pairs. One roster of a few hundred rows should take milliseconds (not yet measured). The limits are the request size and one Node process, plus a single MongoDB node.
**Main risk:** the 150-minute plan has no spare buffer, and the dashboard (33 minutes) and the database work (20) are the parts most likely to overrun. If they do, milestone 4 shrinks and the app ships with `saved: false` and no history.

### B. Balanced: accounts and per-user history

**Architecture**
1. The same dashboard as A, plus login screens and a per-user history view.
2. Express API with JWT login (bcrypt) and the same rules engine.
3. The same MongoDB, plus a users collection, and results owned by a user.
4. The same Compose stack.
5. Roles per store.

**Tech:** A's stack plus JWT, bcrypt and Axios.
**Pros:** closer to a real product. Each manager sees their own history. Shows more of your stack.
**Cons:** login, password handling and ownership checks take time the rules need, and there is more to secure.
**Build time:** an estimate of about 5 to 6 hours, not measured.
**Security:** needs password handling, token expiry and per-user access checks.
**Main risk:** the time box runs out before the rules and tests are finished.

### C. Ambitious: roster platform

**Architecture**
1. Everything in B.
2. Roster versioning and diff (D10), scheduled checks and notifications.
3. Integration with the rostering system (I1).
4. Ollama phrases findings in plain English, with rules still deciding (I4).
5. CI/CD with GitHub Actions, deployed to EC2.

**Tech:** B plus a queue or scheduler, Ollama, GitHub Actions.
**Pros:** closest to a finished product. Covers I1, I3 and I4.
**Cons:** much of it depends on facts we don't have (what the rostering system is, who owns it).
**Build time:** 8 hours or more.
**Security:** the largest surface: integration credentials, per-store permissions, a model that sees personal data.
**Main risk:** nothing is finished, and the design rests on guesses.

## Recommendation: Approach A

I recommend **A**.

**Why I can defend it**
- The brief asks for a check before the roster goes out. The core is a function of its input, and the mandatory database only has to keep the results, so nothing else is needed.
- It meets every mandatory item (React + Vite, Express, Mongoose, Compose, EC2) without adding accounts, versioning or integrations that the brief doesn't ask for.
- Correctness is the scored part, so the time goes to the rules and their tests. A wrong flag is worse than a modest UI.
- The stored data is minimal (no names, 30-day expiry), which keeps the privacy risk of adding a database small (S1).
- No AI is needed, so it passes "works without AI" and "third-party APIs banned" with no change to the app.
- It grows into B without a rewrite, because the rules engine has no HTTP or database code in it.

**Build order (the way to protect the deadline).** Four milestones, in this order. Each one leaves a working app, and MongoDB is last on purpose:

1. **Milestone 1: rules and `POST /api/check`**, tested locally with no database.
2. **Milestone 2: React dashboard** with the sample-data button, red or green banner, severity badges and findings table.
3. **Milestone 3: deploy to EC2** with only the `app` service in Compose, and check the live URL.
4. **Milestone 4: add MongoDB:** Mongoose models, saving, the history routes, the `mongo` service in Compose, the History list and the database tests. Then redeploy.

**If time runs out before milestone 4,** the deployed app still works: `POST /api/check` returns its findings with `saved: false`, and the dashboard shows the History list as unavailable. Nothing before milestone 4 depends on the database.

**Time plan: 150 minutes, no spare buffer.** The protection is the order above: milestone 4 is last, so it is what shrinks or goes if earlier milestones overrun. The rules and their tests are not cut.

| Milestone | Step | Minutes |
|---|---|---|
| 1 | Scaffold, `GET /health`, structured logging, env config | 8 |
| 1 | CSV parsing and row validation | 12 |
| 1 | Rules: sweep-line overlap, rest, leave, duplicates | 25 |
| 1 | `POST /api/check`: key check, input limits, clear errors, summary | 8 |
| 1 | Critical tests: parse, rules (nested, 3-way, touching, 11h), seed answer key, API and key checks | 10 |
| 2 | React dashboard: key box, file pickers, **sample-data button**, red or green banner, severity badges, findings table (minimal styling) | 33 |
| 3 | Dockerfile, Compose (`app` only), deploy to EC2, live check | 18 |
| 4 | Mongoose models, saving, history routes, database failure handling, `mongo` service in Compose | 20 |
| 4 | History list in the dashboard | 5 |
| 4 | Database tests | 7 |
| 4 | Redeploy and live check | 4 |
| | **Total** | **150** |

**Where the time came from.** Compared with an earlier draft that kept MongoDB outside the 150 minutes and had a 15-minute buffer, persistence, its tests, the History list and the redeploy add 36 minutes. They were paid for by dashboard polish (12 down to 3), non-critical tests (18 down to 10, so the separate key-leak scan test and extra error-case tests are manual or later), small trims to the API step (10 to 8) and the first deploy (20 to 18), and the whole buffer (15).

**Risks.** There is no buffer, and the estimates for the rules (25), the dashboard (33) and the database work (20) are tight. The first Docker build on the instance can be slow. If milestone 1 or 2 overruns, milestone 4 absorbs it.

**After the Musts, in this order:** the GitHub Actions test workflow (NFR-R11), deleting a saved result (FR-26), UI filters and JSON download (FR-18, FR-19), fix hints (FR-15), configurable rest hours (FR-22), a least-privilege MongoDB user, and last the optional AI explanation (FR-20, lowest priority, scope unchanged). The core pipeline doesn't depend on any of them.

**Pre-work outside the clock:** launching the EC2 instance, its security group, and installing Docker. This is console work, probably 10 to 15 minutes, so start it first and let it run while coding.

**Dependencies:** runtime `express` and `mongoose`. For the client build, `react`, `react-dom`, `vite` and `@vitejs/plugin-react`. For tests, `jest` and `supertest` (dev only). CSV parsing is hand-written (Decision 1), and there's no file-upload package (Decision 3). Stock image: `mongo` (added at milestone 4). Mongoose is outside your listed skills, so I'd explain it in the demo notes.

**Where this approach is weak, and how I'd say so:** one shared key and no accounts (S2), no per-user history, one database node with no backups, and no saved results if milestone 4 is not reached. These are listed under "Consciously leaving out" and are not hidden.

## Trade-off table

| Criterion | A. With persistence | B. Accounts | C. Ambitious |
|---|---|---|---|
| Build time | 150 min, no spare buffer, MongoDB built last | ~5-6h (estimate) | 8h+ |
| Chance of finishing in the time box | Medium (tight) | Low | Low |
| Covers the core need (check before publishing) | Yes | Yes | Yes |
| Mandatory stack covered | Yes | Yes | Yes |
| Extra requirements covered | Saved results (FR-23 to FR-25) | Accounts, per-user history | Versioning, notifications, integration |
| Depth of testing possible | High | Medium | Low |
| Personal data handling | IDs only, 30-day expiry | Adds user data, needs more rules | Shared with integrations |
| Security surface | Small to medium | Medium | Large |
| Operability (health, logs, recovery) | Three containers, one disk, no backups | Same, plus accounts | Many parts to monitor |
| Scales to 10x | Yes for rows, one process and one database node | Yes | Designed to, untested |
| Uses my known stack | Node, Express, MongoDB, React, Docker, AWS; Mongoose is new | A's stack plus JWT, bcrypt | Adds Ollama, GitHub Actions |
| Easy to explain to the panel | Yes | Yes | Hard |

## Consciously leaving out

Each item says why, and what would bring it back.

| Left out | Why | What would add it |
|---|---|---|
| User accounts, per-user history, per-store permissions | S2, U2: one shared key is enough for the demo, on fictional data | Real staff data goes in (S1) |
| Roster versioning and comparison | D10: one upload is one roster | Customer wants "what changed since last publication" |
| Backups, replication and encryption at rest for MongoDB | The data is short-lived and can be re-uploaded (Decision 8) | The customer needs durable history, which means Atlas or another managed service |
| A least-privilege MongoDB user | Takes extra time. The root user is used inside a private network with no published port. | Time is left after the Musts |
| Hours, overtime, break, cover and skills rules | B5: not in the brief | Customer ranks them (B5 question) |
| Overnight shifts and time zones | D6: not in the seed | A store runs nights |
| Integration with the rostering system | I1: unknown system | Customer names it |
| Notifications | I3 | Customer asks |
| AI beyond the optional explanation | I4: a bonus, never needed | Plain-English wording is wanted |
| CI/CD | Time box | Handover to a team |
| Pending or rejected leave | D7: only `approved` in the seed | Customer says which statuses count |
| Dashboard filters and download (FR-18, FR-19) | Should items | Time is left after the first build |

## Why build, not buy

- **Case for building:** the rules are specific (11h rest, cross-store clashes, bad rows reported but not fatal), and the tool has to sit right before publishing. A small checker is likely to be quicker to put in place than choosing, configuring and rolling out a new rostering product (my estimate, not measured), and its logic is easy to inspect.
- **Case for buying:** if the chain's rostering tool already has conflict checks, switching them on is cheaper, and a bespoke tool becomes something to maintain. I haven't verified this, but it is a real possibility.
- **What I don't know:** which tool they use and what its checks cover (B6, unconfirmed). I haven't checked any product, so I won't claim that one lacks these features.
- **How I'd answer the panel:** "I'd confirm first. If the existing tool covers it, use that. If not, or if the checks run too late, this small checker sits in front of it and costs almost nothing to run. It's also a useful way to test the rules before paying for a product."

## If third-party APIs are banned

- **What breaks in A:** nothing in the application. The checker makes no outside calls, and MongoDB runs in our own container. This is one reason Decision 8 chose a container over Atlas, which is a hosted third-party service. The seed data, rules and tests run on the box.
- **What to check:** package dependencies are not APIs, but a ban may cover them too. The runtime needs only Express and Mongoose. React and Vite are used at build time, and Jest and Supertest only for tests. The CSV parser is already hand-written.
- **Nothing else calls out.** With plain HTTP (Decision 9) there is no certificate step, so the deployed system makes no outside calls at all. The cost of that choice is that traffic is unencrypted, which is stated in the README and the dashboard.
- **What stays:** all rules, tests, Docker, MongoDB and the AWS host.
- **What would break in B and C:** hosted login, Atlas, Ollama if it isn't local, any rostering integration (I1) and CI services.
- **Smallest change:** make sure the app never calls out (no analytics, no fonts, no CDN scripts on the page), and pin dependencies.
- **Spoken answer (about 45 seconds):** "That wouldn't change the design. The checker is self-contained: it takes the files, runs the rules on our own server, saves the result in a database running in our own container, and returns findings. The app makes no calls to outside services, and AI isn't needed. If the ban also covers packages, the server needs only Express and Mongoose, the React tooling is used at build time, and the CSV reading is small enough that we wrote it ourselves. The extras I left out, like a hosted login or a link to the rostering system, would use self-hosted options."

## 10x volume

- A roster of ~150 shifts becomes ~1,500 shifts or about 20 stores. The check should still run in well under a second, because it sorts per employee and sweeps once. The cost is O(n log n + k), where k is the number of overlapping pairs reported, and reporting is capped by `MAX_FINDINGS`.
- Stored data grows with uploads: about ten times the rows per check, kept 30 days. A saved roster is held in one MongoDB document, so the request size limit must keep it well under MongoDB's 16 MB document limit. Findings are separate documents, so they don't hit that limit.
- The limits are request size, one Node process and a single MongoDB node. Next steps: check one store at a time, set a per-request size, and move the database to a managed service for durability.
- Beyond that: a queue and a worker for large rosters. That means moving towards B or C, and the rules engine moves with it unchanged.
- I haven't measured any of this. The first test run should record a real number.

## Decisions still open before coding

1. **Unencrypted HTTP for the demo.** Confirm the demo uses only fictional data and a temporary key, and that the key is changed or the instance stopped afterwards. Real staff data must never be used until encrypted transport is added.
2. **Zero spare time.** The 150-minute plan has no buffer. Milestone 4 (MongoDB) is where time is cut if earlier milestones overrun. Confirm that shipping with `saved: false` and the History list marked unavailable is acceptable in that case.
3. **Retention and storage:** confirm 30 days, IDs only, no names (S1), and `MAX_FINDINGS` of 1000.
