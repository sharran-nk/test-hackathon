# Roster Checker

> **Demo over unencrypted HTTP. Use fictional data only.**
>
> Passwords, tokens and roster data cross the network unencrypted. The demo logins in this README are public by design, so they must never be used with real data.
>
> **Live:** `http://ec2-13-233-71-31.ap-south-1.compute.amazonaws.com:3000`. It runs the version described below (source commit `a310f1d`, two containers: app and MongoDB), deployed on 2026-11-16. The manager password is a random value that exists only in the server's `.env`; the `manager123` in this README is the **local** demo value and is refused on the live site. Employee passwords are in `credentials.txt` on the server, to be handed over by `scp`. What was verified on the instance, and what was not, is in [docs/DEPLOY.md](docs/DEPLOY.md). The previous build (shared key) is kept stopped on the same instance for rollback.

## Overview

Store managers publish rosters, and double-bookings are found only when someone fails to show up. Roster Checker reads three CSV files (employees, shifts, leave) before the roster is published and lists every conflict with the employee and shift IDs involved. It warns; it never blocks.

On the seed data in `case/seed/` it reports exactly the six planted problems and nothing else:

| Rule | Employee | Shifts |
|---|---|---|
| `SHORT_REST` | E003 | SH013, SH021 |
| `DUPLICATE_ROW` | E005 | SH091 |
| `OVERLAP` | E007 | SH024, SH025 |
| `DATA_BAD_ROW` | E010 | SH086 |
| `OVERLAP` | E012 | SH033, SH041 |
| `ON_LEAVE` | E015 | SH098 |

The checks are plain rules. There is no AI, and the app needs no outside service.

## Architecture

```
Browser (React, Vite build)
   |  HTTP :3000   JWT in the Authorization header
   v
app container (Node 22, non-root user "node")
   Express: JWT auth + roles -> routes -> CSV parser -> rules engine
   Mongoose --------------------------------------+
                                                  | private Docker network (internal: true)
                                                  v
                                   mongo container (MongoDB 7, authentication on)
                                   named volume mongo_data, NO published port
```

- **React + Vite** single-page app, served by Express from the same container as the API.
- **Express** API. The validation rules are deterministic and do not touch the database.
- **MongoDB + Mongoose** stores accounts and saved checks. Four collections:

| Collection | Holds | Expires |
|---|---|---|
| `users` | username, role (`manager` or `employee`), employee ID, **bcrypt hash**, `active` flag | never |
| `rosters` | the rows that passed validation: employee ID and home store, shift fields, leave fields. **No names, roles or contracted hours.** | after `RETENTION_DAYS` (default 30) |
| `validationresults` | the summary of one check, and which roster it belongs to | after `RETENTION_DAYS` |
| `findings` | one document per finding, with a sequence number that keeps the order | after `RETENTION_DAYS` |

Retention is a MongoDB TTL index on `createdAt`. MongoDB's cleaner runs about once a minute, so a record disappears shortly after it is 30 days old, not at the exact second. **Tested:** the TTL indexes exist with the right value. **Not observed:** an actual expiry deleting a record (it needs 30 days or a test instance with a tiny `RETENTION_DAYS`).

A check is saved in this order: roster, findings, then the result last, so a result never exists without its findings. MongoDB here is standalone and has no multi-document transactions, so none are used. If a step fails, what was written is deleted again. If that cleanup also fails, the leftovers have no result, so no API can reach them, and the TTL removes them.

## Accounts and permissions

| | Manager | Employee |
|---|---|---|
| Username | `manager` | the employee ID, for example `E003` |
| Password | `MANAGER_PASSWORD` from `.env` (demo value `manager123`) | random, generated once at seeding, written to `credentials.txt` |
| Upload a roster and run a check | yes | no (403) |
| See saved history, open or delete a result | yes | no (403) |
| See own shifts, leave and findings | no (403) | yes, **only their own** |

- Passwords are stored only as bcrypt hashes (`bcryptjs`, cost 10). They are never returned by an API or written to logs.
- **JWT:** HS256, signed with `JWT_SECRET` (at least 32 characters, the server refuses to start otherwise). A token expires after `JWT_EXPIRES_IN` (default `8h`). Other algorithms, wrong signatures, edited payloads and expired tokens get 401.
- **Roles are checked on the server on every request.** The employee's identity comes from the verified token, never from the URL, query or body, so an employee cannot ask for someone else's data.
- **Fail closed.** Every protected request looks the account up in MongoDB: it must exist, be `active`, and still have the role in the token. If MongoDB cannot be reached, the answer is **503 `AUTH_UNAVAILABLE`**, even with a valid token. Login is also 503.
- **Logout** (`POST /api/auth/logout`) ends that token. The list of ended tokens is **in memory**, so a server restart forgets it (the token then lives until it expires).
- The browser keeps the token **in React memory only**. A reload signs you out. Nothing is written to `localStorage`, `sessionStorage`, cookies or the URL.
- An employee sees the **latest saved** roster check, whoever uploaded it. There is no separate publish step (see assumption A3).

## What happens when MongoDB is down

| Request | Result |
|---|---|
| `GET /health` | `200 {"status":"ok"}`. **This only shows the Node process is alive. It does not check MongoDB**, so a healthy container can still have no database. |
| Login, `/api/check`, `/api/history*`, `/api/me/schedule`, `/api/auth/me`, `/api/auth/logout` | **503 `AUTH_UNAVAILABLE`**: the account cannot be verified, so nothing is checked and no findings are returned. |
| `/api/check` when the account **is** verified but saving fails (for example the connection drops during the save) | `200` with the findings and `saved: false`, `resultId: null`. |
| History routes when the account is verified but the data read fails | 503 `HISTORY_UNAVAILABLE` |

The server keeps retrying the connection. Tested: with MongoDB stopped everything above gave 503, and after it was started again history returned 200 without restarting the app.

## What is built

- `POST /api/check`: hand-written CSV parsing and validation, then six rules: same-store overlap, cross-store overlap, shift on approved leave, rest under 11 hours, exact duplicate rows, malformed or unknown-reference rows.
- Login for two roles, JWT, role checks, saved history with pagination and delete, an employee schedule endpoint.
- React portal: landing page with Manager Login and Employee Login, manager dashboard, upload with a sample-data button, results table, history, employee portal, and the HTTP-only footer on every screen.
- Docker Compose with an authenticated, private MongoDB.

**Not built:** GitHub Actions, JSON download, filters beyond the result tabs, fix hints, AI explanations, password change or reset, login rate limiting, per-store permissions.

## Project structure

```
Dockerfile              multi-stage build: React build, production dependencies, small runtime image
docker-compose.yml      app + mongo, private network, named volumes
.env.example            variable names with placeholder values
app/
  package.json          server dependencies, "test" and "build" scripts
  server/               Express: auth, routes, store (database access), models, parse, rules, seed
  client/               React + Vite portal (client/src/App.jsx is the entry)
  tests/                Jest + Supertest tests (database tests use mongodb-memory-server)
case/                   the brief and the seed CSV files (answer key in case/seed/README.md)
docs/                   REQUIREMENTS, ASSUMPTIONS, DECISIONS, DEPLOY, DEMO, ARCHITECTURE_FULL
SOLUTION_DESIGN.md      the solution design
```

## Environment variables

Set in `.env` (never committed). `.env.example` lists the names with placeholders. Compose refuses to start if a required one is missing.

| Name | Required | Meaning |
|---|---|---|
| `JWT_SECRET` | yes | Signs login tokens. At least 32 random characters. |
| `JWT_EXPIRES_IN` | no (`8h`) | Login lifetime, for example `30m`, `8h`, `1d`. |
| `MANAGER_PASSWORD` | yes | Password for `manager`. Hashed on first creation only. Changing it later does **not** change an existing manager (see below). |
| `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD` | yes | MongoDB root login. The app URL-encodes them when it builds its connection string, so special characters work (tested with `Zq7@x:/#y%9`). |
| `MONGO_HOST` | no (`mongo`) | Set by Compose to the service name. |
| `MONGODB_URI` | no | Local development outside Docker only. If set it replaces the parts above. Compose does not use it. |
| `RETENTION_DAYS` | no (`30`) | Days before saved rosters, results and findings expire. |
| `PORT` | no (`3000`) | Server port inside the container. Keep 3000. |
| `APP_PORT` | no (`3000`) | Compose only: the host port to publish. |
| `MAX_BODY_KB`, `MAX_FINDINGS`, `MIN_REST_HOURS` | no | Request size limit (1024), finding cap (1000), minimum rest (11). |

**Changing MongoDB credentials later.** `MONGO_ROOT_USERNAME` and `MONGO_ROOT_PASSWORD` are read by the MongoDB image **only the first time its volume is created**. Editing them in `.env` afterwards does not change the existing database user. Tested: after changing the password, the `mongo` container became `unhealthy` (the health check could no longer log in) and the app did not start. To change a password, change it inside MongoDB (`db.changeUserPassword`) and in `.env` together, or, if the data may be lost, start from a new volume. The same applies to `MANAGER_PASSWORD`: the existing manager's hash is never overwritten on restart.

## Run with Docker Compose

Needs Docker with Compose v2.

```bash
cp .env.example .env
# edit .env: set JWT_SECRET (32+ random characters), MANAGER_PASSWORD, MONGO_ROOT_PASSWORD
docker compose up -d --build
docker compose ps                  # both services should show (healthy)
curl -s http://localhost:3000/health
```

If port 3000 is busy on the host, set `APP_PORT=3100` in `.env`.

### Create the employee accounts and collect their passwords

The manager account is created automatically when the app starts. Employee accounts are created by the seed script, one per `employee_id` in `employees.csv`, each with a random password. The script runs once, **never regenerates an existing password**, and writes only the new accounts' passwords to a file.

```bash
mkdir -p secrets
docker compose run --rm --no-deps \
  -e CREDENTIALS_FILE=/out/credentials.txt \
  -v "$PWD/case/seed:/seed:ro" \
  -v "$PWD/secrets:/out" \
  app node server/seed.js /seed/employees.csv
```

Two bind mounts are needed because the image does not contain the CSV (`/seed`, read-only) and the credentials must come out of the container (`/out`). The result is `secrets/credentials.txt` with lines `E001,<password>`. `secrets/` and `credentials.txt` are git-ignored and excluded from the image. Passwords are never printed or logged. The file holds plaintext passwords, so hand each employee only their own line, then delete the file.

- **Git Bash on Windows:** put `MSYS_NO_PATHCONV=1` in front of the command. Without it Git Bash rewrites `/seed` and `/out` into Windows paths and the seed fails with an unhelpful `seed failed: Error`. PowerShell does not need it (use `${PWD}` instead of `$PWD`).
- **Linux:** the container user is `node` (uid 1000), so the folder must be writable by it: `install -d -m 700 -o 1000 -g 1000 secrets`. Tested on Windows with Docker Desktop only; the Linux permissions step is untested.
- `--no-deps` expects `mongo` to be running already (`docker compose up -d` first).

## Run locally without Docker

Needs Node.js (tested with Node 24; the image uses Node 22.12) and a MongoDB you run yourself. The Compose database cannot be used for this, because it has no published port by design. Point the app at your own MongoDB with `MONGODB_URI`. This path was not re-run in this milestone (the Docker path was):

```bash
cd app && npm install && cd client && npm install && cd ..
npm run build                       # builds the React app into app/client/dist
export JWT_SECRET=<32+ random characters> MANAGER_PASSWORD=manager123
export MONGODB_URI=mongodb://localhost:27017/roster
npm start                           # http://localhost:3000
node server/seed.js ../case/seed/employees.csv   # employee accounts, writes ./credentials.txt
```

Without a reachable MongoDB the server still starts and serves `/health`, but nobody can log in (503).

## Run the tests

```bash
cd app
npm test            # always use this, not bare "npx jest" (the Mongo driver needs --experimental-vm-modules)
npm run build       # builds the client
```

The database tests start a real MongoDB with `mongodb-memory-server` (it downloads a MongoDB binary the first time, so the first run needs internet). Docker is not needed for the tests. The last run is in the table below.

| Suite | What it covers |
|---|---|
| `rules.test.js`, `parse.test.js`, `describe.test.js` | every rule (nested, three-way, touching, exactly 11h), parsing, result wording |
| `seed.test.js` | the seed files give exactly the six findings through the API |
| `api.test.js` | check endpoint, token required before the body is read, input errors, size limit, no leaks in 500s and logs, config |
| `db.test.js` | connection, URI encoding, indexes and TTL, no names stored, seeding and bcrypt, no regenerated passwords, failure logging |
| `history.test.js` | saving, order, pagination, delete cascade, partial failures and cleanup, outage behaviour |
| `auth.test.js` | both logins, wrong/inactive/deleted accounts, forged/expired/logged-out tokens, role restrictions, employee isolation, fail closed |
| `ui.test.js` | login decisions and, by rendering the real React components to HTML, what each role sees in each state. **It cannot click or type.** |
| `security.test.js`, `notice.test.js`, `compose.test.js` | no browser storage or HTML injection, no token in URLs, the HTTP footer and its contrast, Compose keeps MongoDB private |

## API

`Authorization: Bearer <token>` on everything except `/health` and login.

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/health` | anyone | `{"status":"ok"}`. Process liveness only, **not** a database check. |
| POST | `/api/auth/login` | anyone | `{username, password}` gives `{token, user}`. |
| GET | `/api/auth/me` | signed in | username, role, employee ID. |
| POST | `/api/auth/logout` | signed in | ends this token (204). |
| POST | `/api/check` | manager | check one roster; body: JSON with `employees` and `shifts` as CSV text and optional `leave`. Returns `findings`, `summary`, `saved`, `resultId`. |
| GET | `/api/history?page=1&limit=20` | manager | saved checks, newest first. `limit` is capped at 100. |
| GET | `/api/history/:id` | manager | one saved check with its findings in order. |
| DELETE | `/api/history/:id` | manager | delete a check with its findings and roster (204). |
| GET | `/api/me/schedule` | employee | the caller's own shifts, leave and findings from the latest saved roster. `hasRoster: false` if none. |
| GET | `/` | anyone | the React app. |

Errors: 400 `INVALID_REQUEST`, 401 `UNAUTHORIZED` or `INVALID_CREDENTIALS`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 413 `TOO_LARGE`, 500 `INTERNAL` (generic, with a request ID), 503 `AUTH_UNAVAILABLE` or `HISTORY_UNAVAILABLE`.

```bash
TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"username":"manager","password":"manager123"}' http://localhost:3000/api/auth/login \
  | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).token")

node -e "const fs=require('fs');const r=f=>fs.readFileSync('case/seed/'+f,'utf8');fs.writeFileSync('body.json',JSON.stringify({employees:r('employees.csv'),shifts:r('shifts.csv'),leave:r('leave.csv')}))"
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d @body.json http://localhost:3000/api/check
```

On the seed data the counts are `DATA_BAD_ROW 1, DUPLICATE_ROW 1, UNKNOWN_REF 0, OVERLAP 2, SHORT_REST 1, ON_LEAVE 1`.

## Demo credentials

| Role | Username | Password |
|---|---|---|
| Manager | `manager` | the value of `MANAGER_PASSWORD` (the demo value is `manager123`) |
| Employee | `E001` ... `E025` | random, in `secrets/credentials.txt` after seeding |

`manager123` is a deliberately weak, public demo password. Use it only with the fictional seed data and never on a reachable host with real data. The walkthrough is in [docs/DEMO.md](docs/DEMO.md).

## Backup and restore

MongoDB runs in a container on one disk with no automatic backups. Manual backup of the `roster` database (accounts and saved checks):

```bash
docker compose exec -T mongo sh -c 'mongodump --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin \
  --db roster --archive --gzip' > roster-backup.archive.gz
```

Restore (replaces the current contents of those collections):

```bash
docker compose exec -T mongo sh -c 'mongorestore --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin \
  --archive --gzip --drop' < roster-backup.archive.gz
```

**Tested** (Windows, Docker Desktop, with `MSYS_NO_PATHCONV=1` in Git Bash): backup of 34 documents, database dropped (login then failed and the old token got 401), restore reported 34 documents restored, then manager login, employee login, the saved history entry and the employee's finding all worked again. The backup contains password hashes and roster data, so protect it like the database. A backup restores the data as of that moment, including records that would have expired since. Restoring onto a different volume works only if the new volume's root user matches `.env`.

## Security notes and limitations

- **HTTP only.** No TLS and no domain. Tokens, passwords and roster data cross the network unencrypted. Use fictional data, change the demo passwords, and delete the instance afterwards.
- **Demo credentials are public** (`manager` / `manager123`) and there is a single shared manager account. No per-manager accounts, no password change or reset, **no login rate limiting** (passwords can be guessed repeatedly).
- **Logout does not survive a restart** (the ended-token list is in memory), and a token lives until it expires (8 hours by default).
- **The app connects to MongoDB as the root user.** A least-privilege database user (`readWrite` on `roster` only) would be better and is not done. MongoDB is reachable only from the app container.
- **Secrets.** `.env`, `credentials.txt` and `secrets/` are git-ignored and kept out of the image. Compose passes only the listed variables to the app. A scan of the container logs after a full test found no database password, manager password, employee password, JWT secret or live token. The secrets are still visible to anyone who can run `docker inspect` on the host.
- **Names are never stored or logged.** Logs hold method, path, status, timing, and error names only. Findings use employee IDs.
- **Employees see the latest saved check, even if it has problems.** There is no draft or publish step.
- **MongoDB is a single instance.** No replication, no failover, manual backups only.
- **Ports.** In the Docker test, 3000 (or `APP_PORT`) answered, `mongo` published no port and answered nothing on the LAN addresses of the machine. (A MongoDB installed on the host itself answered on 127.0.0.1:27017; that is unrelated to the container.) On EC2 (2026-11-16) from outside: 3000 answers and 27017 gives no answer; the security group has SSH from one address, 3000 and also 80 and 443 open to everyone (nothing listens on 80 or 443).
- **Quoted commas are not supported** by the hand-written CSV parser. A field such as `"Smith, Jo"` is split and the row is reported as a bad row.
- **Touching shifts raise `SHORT_REST`.** A shift that ends when the next starts is not an overlap, but has under 11 hours of rest. Whether the customer wants that is unconfirmed.
- **UI testing is limited.** There is no browser test. The screens are checked by rendering tests plus the manual checklist in `docs/DEMO.md`, which has **not** been ticked by a human yet.

**Docker restart behaviour.** `restart: unless-stopped` restarts a crashed container but not one stopped by a manual `docker kill` (Docker treats that as deliberate; seen on EC2: exit 137, stayed down). To show recovery use `kill -9` on the process. Rebooting the instance has not been tested.

## Requirements traceability

The full table, with files, tests and status, is in [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md). Status `verified` means a test was run and passed. Items checked on the EC2 instance are marked as such and refer to the earlier build.

## Assumptions

The brief is incomplete on purpose, so many choices are guesses (11-hour rest, only approved leave counts, one time zone, one manager account, employees see the latest saved check). Every one is listed, with its risk, in [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md). Decisions and their reasons are in [docs/DECISIONS.md](docs/DECISIONS.md).
