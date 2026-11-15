# Roster Checker

> **Demo over unencrypted HTTP. Use fictional data only.**
>
> Live: http://ec2-13-233-71-31.ap-south-1.compute.amazonaws.com:3000
>
> **Temporary demo, HTTP only, fictional data, temporary access key.** The key is not in this repository. Anything typed into the page can be read on the network.

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

## What is built and what is not

**Built and running**
- `POST /api/check`: hand-written CSV parsing and validation, then six rules: same-store overlap, cross-store overlap, shift on approved leave, rest under 11 hours, exact duplicate rows, malformed or unknown-reference rows.
- Shared access key on every `/api` route, `GET /health`, JSON logs without names or keys, request size limit, clear error messages.
- React portal: landing page, manager sign-in (the password is the access key), dashboard, upload with a sample-data button, results table, and the HTTP-only footer on every screen.
- Docker image and Compose file, deployed to one EC2 instance.

**Not built yet**
- **MongoDB and saved history.** `POST /api/check` always returns `saved: false`, `resultId: null`. There is no `GET /api/results` route. The History tab is a placeholder. The `mongo` service is not in `docker-compose.yml`. Requirements FR-23, FR-24, FR-25, FR-27 are therefore **not met** and `GET /health` has no `db` field.
- **Employee portal.** The Employee card opens a notice only. There is no employee sign-in.
- Not started: GitHub Actions, delete route, filters, JSON download, fix hints, AI explanations.

## Project structure

```
Dockerfile              multi-stage build: React build, production dependencies, small runtime image
docker-compose.yml      the app service only
.env.example            variable names with placeholder values
app/
  package.json          server dependencies and the test script
  server/               Express app: auth, routes, CSV parsing, rules, logger, config
  client/               React + Vite portal (client/src/App.jsx is the entry)
  tests/                Jest + Supertest tests
case/                   the brief and the seed CSV files (answer key in case/seed/README.md)
docs/                   REQUIREMENTS, ASSUMPTIONS, DECISIONS, DEPLOY, DEMO, ARCHITECTURE_FULL
SOLUTION_DESIGN.md      the solution design
```

## Run locally

Needs Node.js. These steps were run on Windows with Node 24; the Docker image uses Node 22.12.

```bash
cd app
npm install
cd client
npm install
npm run build        # writes app/client/dist, which Express serves
cd ..
ACCESS_KEY=pick-a-long-random-value npm start
# open http://localhost:3000
```

PowerShell: set the key first with `$env:ACCESS_KEY = "pick-a-long-random-value"`, then `npm start`.

The server refuses to start without `ACCESS_KEY`. If port 3000 is busy, add `PORT=3100`.

## Run the tests

```bash
cd app
npm test
```

The last run was 7 suites, 126 tests, all passing. The tests cover parsing, each rule (nested, three-way, touching, exactly 11 hours), the seed files giving exactly six findings, the API and key checks, security source scans, and the HTTP-only notice. There are no browser tests: the screens are checked by hand with `docs/DEMO.md`.

The client build is checked separately: `cd app/client && npm run build`.

## Docker and deploy

Local container (needs `.env`, see below):

```bash
cp .env.example .env          # then put a long random value in ACCESS_KEY
docker compose up --build -d
docker compose ps             # should show (healthy)
curl.exe -s http://localhost:3000/health
```

If port 3000 is busy on your machine, set `APP_PORT=3100` in the shell before `docker compose up`. The container always listens on 3000 inside.

EC2 (Ubuntu 24.04, 1 GB of RAM worked with 2 GB of swap added first). The full, tested steps are in [docs/DEPLOY.md](docs/DEPLOY.md). In short:

```bash
sudo apt-get install -y docker.io docker-compose-v2
git clone https://github.com/sharran-nk/test-hackathon roster-checker
cd roster-checker
cp .env.example .env
sed -i "s/^ACCESS_KEY=.*/ACCESS_KEY=$(openssl rand -hex 24)/" .env
sudo docker compose up -d --build
curl -s http://localhost:3000/health
```

**Restart behaviour.** `restart: unless-stopped` restarts the container after a crash. Docker does **not** restart it after a manual `docker kill`, because it treats that as a deliberate stop (seen on the instance: exit code 137, stayed down). To test recovery, kill the app process instead: `sudo kill -9 $(sudo docker inspect -f '{{.State.Pid}}' roster-checker-app-1)`. Rebooting the instance has not been tested.

## Environment variables

Set in `.env` (never committed). `.env.example` lists the names with placeholder values.

| Name | Meaning |
|---|---|
| `ACCESS_KEY` | Required. The shared key for every `/api` request and the manager sign-in. |
| `PORT` | Port the server listens on (3000). Keep 3000 with Docker. |
| `MAX_BODY_KB` | Request body limit in KB. |
| `MAX_FINDINGS` | Stop reporting after this many findings; the response says `truncated`. |
| `MIN_REST_HOURS` | Minimum hours between two shifts. |
| `APP_PORT` | Optional, Compose only: the host port to publish. Defaults to 3000. |

## API

Every `/api` request needs `Authorization: Bearer <ACCESS_KEY>`. A missing or wrong key gets 401 with no other detail.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | `{"status":"ok"}`. No key needed. |
| POST | `/api/check` | Check one roster. Body: JSON with `employees` and `shifts` as CSV text, and optional `leave`. |
| GET | `/` | The React app. |

Errors: 400 invalid request, 401 unauthorized, 404 no such route, 413 body too large, 500 internal.

Sample requests, as run against the live app and the local container:

```bash
curl.exe -s http://localhost:3000/health
# {"status":"ok"}

curl.exe -s -i -X POST -H "Content-Type: application/json" -d "{}" http://localhost:3000/api/check
# HTTP/1.1 401 Unauthorized

# Build a request body from the seed files, then check it
node -e "const fs=require('fs');const r=f=>fs.readFileSync('case/seed/'+f,'utf8');fs.writeFileSync('body.json',JSON.stringify({employees:r('employees.csv'),shifts:r('shifts.csv'),leave:r('leave.csv')}))"
curl.exe -s -X POST -H "Authorization: Bearer <ACCESS_KEY>" -H "Content-Type: application/json" -d @body.json http://localhost:3000/api/check
```

The response has `summary` (counts per rule, `shiftsReceived`, `shiftsChecked`, `rowsSkipped`, `truncated`, `clear`), `findings` (each with `rule`, `employeeId`, `shiftIds` and a plain-language message), `saved` and `resultId`. On the seed data the counts are `DATA_BAD_ROW 1, DUPLICATE_ROW 1, UNKNOWN_REF 0, OVERLAP 2, SHORT_REST 1, ON_LEAVE 1`.

## Requirements traceability

The full table, with files and tests, is in [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md). Status: `verified` means the test was run and passed. "Live" means checked on the EC2 instance on 2026-11-15.

| ID | Requirement | Test | Status |
|---|---|---|---|
| FR-01 | `POST /api/check` returns findings | `api.test.js` | implemented (saving not built) |
| FR-02 to FR-04 | CSV parsing, bad dates, duplicates | `parse.test.js`, `rules.test.js` | verified |
| FR-05 to FR-09 | Overlap (same store, cross store, touching), leave, rest | `rules.test.js` | verified |
| FR-10, FR-12 | Finding fields, unknown IDs | `api.test.js`, `parse.test.js` | verified |
| FR-11 | Summary with counts | `api.test.js` | implemented |
| FR-13 | Key required on `/api` | `api.test.js` | verified, live 401 |
| FR-14, FR-21 | Portal and sample-data button | manual (`docs/DEMO.md`) | implemented |
| FR-16 | Seed gives exactly six findings | `seed.test.js` | verified, live |
| FR-17 | Order does not matter | `rules.test.js` | verified |
| FR-23 to FR-25, FR-27 | Saving, history, History tab | none yet | planned |
| FR-15, FR-18, FR-19, FR-20, FR-22, FR-26 | Hints, filters, download, AI, config, delete | none yet | planned |
| NFR-S1 to S6 | Key handling, no secrets, input limits, text not HTML | `api.test.js`, `security.test.js` | verified or implemented, see REQUIREMENTS |
| NFR-S7 | HTTP-only notice, only port 3000 published | `notice.test.js` (source), manual | notice tested in source; live port check done |
| NFR-P1, P4 | No names in logs, IDs only | `api.test.js` | verified |
| NFR-R1, R3, R4, R6 | Clear errors, structured logs, deterministic, env config | `api.test.js`, `rules.test.js` | verified |
| NFR-R2 | `/health` | `api.test.js` | verified live for `status`; `db` field not built |
| NFR-R7 | Restart after a crash | manual | verified live (process kill); reboot not tested |
| NFR-P2, P5, R9, R10, S8 | Database requirements | none yet | planned (MongoDB not built) |
| NFR-R11 | CI on every push | none yet | planned |

## Security notes and limitations

- **HTTP only.** No TLS and no domain. The key and roster data cross the network unencrypted. Use fictional data and a temporary key, and change the key after judging.
- **One shared key.** There are no user accounts. Anyone with the key has full access. The key is compared in constant time, kept in browser memory only, and never logged or returned.
- **No names stored or logged.** Logs hold method, path, status and timing only.
- **Input.** Request size is limited and every field is validated. Findings are shown as text, never as HTML. The page loads nothing from outside.
- **Port exposure, as checked live.** Port 3000 answers. 27017 does not answer (and nothing listens on it, because MongoDB is not deployed). Port 22 answered from my laptop on a phone hotspot. The security group has two SSH rules whose sources I did not check, so SSH may be open to every address. It still needs narrowing to one IP.
- **Quoted commas are not supported.** The CSV parser is hand-written, so a field such as `"Smith, Jo"` is split at the comma and the row is reported as a bad row.
- **Touching shifts raise `SHORT_REST`.** A shift that ends exactly when the next begins is not an overlap, but it has under 11 hours of rest, so it is reported as a short-rest finding. Whether the customer wants that is unconfirmed.
- No backups, one instance, no load balancer, no saved data yet.
- Sign-in is a workaround: the page sends an empty `POST /api/check` and reads the status (401 wrong key, 400 right key).

## Assumptions

The brief is incomplete on purpose, so many choices are guesses (for example: 11-hour rest, only approved leave counts, one time zone, three CSV files shaped like the seed). Every one is listed, with its risk, in [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md). Decisions and the reasons for them are in [docs/DECISIONS.md](docs/DECISIONS.md).
