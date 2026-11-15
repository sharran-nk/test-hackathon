# Decisions

## Decision log

Decided by the user. These answers settle the five open questions at the end of this file, plus the AI question. Where an older section below says otherwise (for example "No React" in Approach A, the React and static-page rows, or the open questions at the end), this log wins.

| # | Decision | Reason |
|---|---|---|
| 1 | **CSV parsing:** hand-written, no dependency. The README will say quoted commas are not supported. | The seed data has no quoted commas. No extra dependency, and the parsing is easy to explain. The limit is stated openly. |
| 2 | **Access:** a shared key from the `ACCESS_KEY` env var, sent as a header. The page asks for it once. | The URL is public, so some gate is needed. This is the smallest one, with no user accounts or database. |
| 3 | **Input:** the page sends CSV text as JSON to `POST /api/check`. | No file-upload package is needed. The server receives text it can validate and size-limit. |
| 4 | **Touching shifts are not an overlap. Exactly 11h rest is allowed.** | A shift ending at 14:00 followed by one starting at 14:00 is a normal handover. Only less than 11h is a rest breach. These rules decide the boundary tests. |
| 5 | **Front end:** React + Vite instead of a static page. Still approach A: stateless, no database, no login. Express serves the built React app. One Docker image, multi-stage build. | The demo must look presentable. The architecture doesn't change, since the rules engine and API are the same. React and Vite are in the stack the user already knows, and the multi-stage build keeps it to one image. |
| 6 | **AI:** optional and explain-only. Rules decide every finding. AI only rewrites the explanation text. Off by default (`AI_MODE=off`). Only IDs, times and rule names are sent, never names. 10s timeout and a template fallback. | AI is a bonus, never a gate, and the app must work without it. Sending no names keeps personal data out (S1). The timeout and fallback mean a slow or missing model can't break a check. |

Inputs: `docs/PROBLEM.md`, `docs/ASSUMPTIONS.md` (IDs like B1 and D3 refer to it), CLAUDE.md. All assumptions are **unconfirmed**. This file is the decision record, so later changes need a reason added here.

## The three approaches

### A. Simple: stateless checker

**Architecture**
1. Browser: one static HTML page. It reads the 3 CSV files in the browser and sends their text as JSON to `POST /api/check`.
2. Express app: validates the request, calls the rules engine, returns findings as JSON. Also serves the page and `GET /health`.
3. Rules engine: a plain module with no HTTP in it. Steps: parse and validate rows, drop exact duplicates, then overlap, rest and leave checks on the valid rows.
4. Nothing is stored: no database, and files are not kept (S1).
5. Docker image on one AWS EC2 box with Docker Compose.

**Tech:** Node.js, Express, Jest, Supertest, Docker, plain HTML and JavaScript. No React and no database.
**Pros:** smallest surface to explain and secure. All the time goes into correctness. No database means nothing personal to protect at rest. Fits the time box.
**Cons:** no saved history, no login, and a plain UI. It looks modest next to B and C.
**Build time:** about 2.5h (split below).
**Security:** input size limit, strict validation, IDs only in logs, no secrets needed. Without a login, the hosted URL is open to anyone who finds it (S2). A shared key in an environment variable is a small fix.
**Scaling:** the check is O(n log n), because rows are grouped per employee and sorted. One roster of a few hundred rows takes milliseconds. Limit is the request size and one Node process.
**Main risk:** an open URL with staff names in the data. Mitigation: use the fictional seed data in the demo, and add the shared key.

### B. Balanced: checker with UI, login and history

**Architecture**
1. React (Vite) front end with upload, results table and filters.
2. Express API with JWT login (bcrypt) and the same rules engine.
3. MongoDB or SQL stores users and past check results.
4. Multi-stage Docker build, Compose with the API and the database.
5. Hosted on EC2.

**Tech:** React, Vite, Express, MongoDB or SQL, JWT, bcrypt, Axios, Jest, Supertest, Docker.
**Pros:** closer to a real product. Shows more of your stack. History lets the customer see trends (B4).
**Cons:** the UI, login and storage use time the rules need. Stored results contain staff data, so privacy duties grow (S1).
**Build time:** about 4 to 5h.
**Security:** needs password handling, token expiry, database access control, retention rules and backups.
**Scaling:** the database lets history grow. The check itself is unchanged.
**Main risk:** the 2.5h box runs out before the rules and tests are finished.

### C. Ambitious: roster platform

**Architecture**
1. React front end with roles per store.
2. API with roster versioning and diff (D10), scheduled checks and notifications.
3. Integration with the rostering system (I1).
4. Ollama phrases findings in plain English, with rules still deciding (I4).
5. CI/CD with GitHub Actions, deployed to EC2.

**Tech:** B plus a queue or scheduler, Ollama, GitHub Actions.
**Pros:** closest to a finished product. Covers I1, I3 and I4.
**Cons:** much of it depends on facts we don't have (what the rostering system is, who owns it).
**Build time:** 8h or more.
**Security:** the largest surface: integration credentials, per-store permissions, a model that sees personal data.
**Scaling:** designed for chain scale, but it would be untested.
**Main risk:** nothing is finished, and the design rests on guesses.

## Recommendation: Approach A

I recommend **A**.

**Why I can defend it**
- The brief asks for a check before the roster goes out. That is a function of its input, so no stored state is needed.
- It fits the time box with room for tests. Correctness is the scored part, so the rules get the time. A wrong flag is worse than a plain UI.
- S1 says don't store staff names. A has no database, which makes that true by design.
- No AI is needed, so it passes "works without AI" and "third-party APIs banned" with no change.
- It grows into B without a rewrite, because the rules engine has no HTTP in it.

**Build-time split (about 165 minutes)**

| Step | Minutes |
|---|---|
| Scaffold, `GET /health`, structured logging, env config | 10 |
| CSV parsing and row validation (D4, D5, D9) | 20 |
| Rules: duplicate, overlap (same and cross store), rest, leave | 35 |
| `POST /api/check` with input limits and clear errors | 10 |
| React UI (Vite): load files, show findings | 40 |
| Tests: one per rule against the seed answer key, plus the edge cases | 25 |
| Dockerfile, Compose, deploy to EC2, check the live URL | 25 |
| Docs and buffer | 0 |

The React UI needs 25 more minutes than the static page, but the buffer was only 10. Using all of it leaves the total at 165 minutes, which is 15 minutes over the 2.5h box. The buffer is gone.

**Dependencies:** `express` for the server, plus `jest` and `supertest` for tests (dev only). I'd write the CSV parsing by hand, since the seed has no quoted commas. If real exports have them (D1), a small parser package would be safer. **I need your decision on this before coding** (see below). No file-upload package: the page sends the CSV text as JSON, so `multer` isn't needed.

**Where this approach is weak, and how I'd say so:** it has no login (S2), no history (B4, D10) and a basic UI. These are listed under "Consciously leaving out" and are not hidden.

## Trade-off table

| Criterion | A. Simple | B. Balanced | C. Ambitious |
|---|---|---|---|
| Build time | ~2.5h | ~4-5h | 8h+ |
| Chance of finishing in the time box | High | Medium | Low |
| Covers the core need (check before publishing) | Yes | Yes | Yes |
| Extra requirements covered | None beyond F1-F9 | Login, history | Versioning, notifications, integration |
| Depth of testing possible | High | Medium | Low |
| Personal data handling | Nothing stored | Stored, needs retention rules | Stored and shared with integrations |
| Security surface | Small | Medium | Large |
| Operability (health, logs, recovery) | Simple, nothing to back up | Database to back up | Many parts to monitor |
| Scales to 10x | Yes for rows, one process | Yes, with history | Designed to, untested |
| Uses my known stack | Node, Express, Jest, Docker, AWS | Adds React, Mongo or SQL, JWT, bcrypt | Adds Ollama, GitHub Actions |
| Easy to explain to the panel | Very | Yes | Hard |

## Consciously leaving out

Each item says why, and what would bring it back.

| Left out | Why | What would add it |
|---|---|---|
| React UI | Static page is enough to show findings, no build step | Customer wants filtering, sorting and many stores (U1) |
| Database and saved history | S1: nothing stored. Not needed for a check | Customer wants trends or an audit trail (B4, D10) |
| Login and per-store permissions | S2, U2: demo only, with the fictional seed data | Real staff names go in (S1), so add a login before then |
| Roster versioning and comparison | D10: one upload is one roster | Customer wants "what changed since last publication" |
| Hours, overtime, break, cover and skills rules | B5: not in the brief | Customer ranks them (B5 question) |
| Overnight shifts and time zones | D6: not in the seed | A store runs nights |
| Integration with the rostering system | I1: unknown system | Customer names it |
| Notifications | I3 | Customer asks |
| AI | I4: a bonus, never needed | Plain-English wording is wanted |
| CI/CD | Time box | Handover to a team |
| Pending or rejected leave | D7: only `approved` in the seed | Customer says which statuses count |

## Why build, not buy

- **Case for building:** the rules are specific (11h rest, cross-store clashes, bad rows reported but not fatal), and the tool has to sit right before publishing. A small checker is likely to be quicker to put in place than choosing, configuring and rolling out a new rostering product (my estimate, not measured), and its logic is easy to inspect.
- **Case for buying:** if the chain's rostering tool already has conflict checks, switching them on is cheaper, and a bespoke tool becomes something to maintain. I haven't verified this, but it is a real possibility.
- **What I don't know:** which tool they use and what its checks cover (B6, unconfirmed). I haven't checked any product, so I won't claim that one lacks these features.
- **How I'd answer the panel:** "I'd confirm first. If the existing tool covers it, use that. If not, or if the checks run too late, this small checker sits in front of it and costs almost nothing to run. It's also a useful way to test the rules before paying for a product."

## If third-party APIs are banned

- **What breaks in A:** nothing. The checker makes no outside calls. The seed data, rules and tests run on the box.
- **What to check:** package dependencies are not APIs, but a ban may cover them too. Express and Jest are the only ones. If a CSV package is used, it can be replaced by about 30 lines of parsing code.
- **What stays:** all rules, tests, Docker, and the AWS host.
- **What would break in B and C:** hosted login, hosted databases, Ollama if it isn't local, any rostering integration (I1) and CI services.
- **Smallest change:** make sure the app never calls out (no analytics, no fonts, no CDN scripts on the page), and pin dependencies.
- **Spoken answer (about 45 seconds):** "That wouldn't change the design. The checker is self-contained: it takes the files, runs the rules on our own server and returns findings. It makes no calls to outside services, and AI isn't needed. If the ban also covers packages, we only use Express and a few test tools, and the CSV reading is small enough to write ourselves. What would be hit are the extras I left out, like a hosted login or a link to the rostering system. For those we'd use self-hosted options."

## 10x volume

- A roster of ~150 shifts becomes ~1,500 shifts or about 20 stores. The check still runs in well under a second, because it sorts per employee and compares neighbours.
- The limits are request size and memory in one process. Next steps: set a size limit per request, check one store at a time, and stream the file for large ones.
- Beyond that: a queue, a worker and a database. That means moving to B or C, and the rules engine moves with it unchanged.
- I haven't measured this. The first test run should record a real number.

## Decisions I need from you before coding

1. **CSV parsing:** hand-written (no dependency, handles the seed) or a small package (handles quoted commas). I recommend hand-written first, with a note in the README.
2. **Access:** no gate, or one shared key in an environment variable? I recommend the shared key, because the URL is public.
3. **Input:** the page sends CSV text as JSON, so no upload package is needed. Is that OK?
4. **Touching shifts and exactly 11h rest** (the proposals in `docs/ASSUMPTIONS.md`): touching shifts are not an overlap, and exactly 11h is fine.
5. **Static page vs React:** I recommend the static page for this time box. React is the first thing to add if time is left over.
