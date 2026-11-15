# Deploy to an Ubuntu EC2 instance

Docker Compose on one EC2 instance: the app container and an authenticated MongoDB container.

**Status.** The steps for the app-only build were run on EC2 on 2026-11-15 (see "Earlier results"). The current version (two containers, JWT login, MongoDB) was verified **locally with Docker Compose only** (see "Verified locally"). It has **not** been deployed to EC2, and the EC2 steps below that differ from the earlier ones (MongoDB, `.env`, seeding) have not been run there. Milestone 8 does that.

The demo is plain HTTP, so it must only ever hold the fictional seed data (see the README warning). Every password and secret is a throwaway used nowhere else.

## 0. Before you start (AWS console)

- Ubuntu 22.04 or 24.04 LTS, at least 2 GB of RAM (for example `t3.small`). A 1 GB instance can run out of memory during the build (section 9). MongoDB's cache is capped at 0.25 GB in `docker-compose.yml` (`--wiredTigerCacheSizeGB`), so it fits beside the app on 1 GB; real memory use on EC2 has not been measured yet.
- Disk: 12 GB or more. MongoDB data and its image need room.
- Security group, inbound only:
  - TCP 22 from **your IP only** (not 0.0.0.0/0).
  - TCP 3000 from anywhere (the app).
  - **Nothing else. 27017 must never be opened.** The `mongo` container publishes no port, so opening it would expose nothing, but keep the rule absent as a second layer.
- Note the public IPv4 address, written `<ip>`.

## 1. Connect and install Docker

```bash
ssh -i <your-key>.pem ubuntu@<ip>
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
exit        # log out and back in so the group change applies
ssh -i <your-key>.pem ubuntu@<ip>
docker --version && docker compose version
```

If `docker-compose-v2` is not found, install Docker from Docker's official apt repository and the `docker-compose-plugin` package.

## 2. Clone

```bash
git clone <repository-url> roster-checker
cd roster-checker
```

## 3. Create `.env` with random secrets

```bash
cp .env.example .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')|" .env
sed -i "s|^MONGO_ROOT_PASSWORD=.*|MONGO_ROOT_PASSWORD=$(openssl rand -hex 24)|" .env
nano .env        # set MANAGER_PASSWORD (the demo value is manager123); check the other values
chmod 600 .env
```

`.env` is in `.gitignore` and `.dockerignore`, so it is never committed and never copied into the image. `docker compose up` stops with a clear message if a required variable is missing: `JWT_SECRET` (32+ characters), `MANAGER_PASSWORD`, `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD`. Keep `PORT=3000`.

**Important: the MongoDB credentials are read only when the data volume is first created.** If you change `MONGO_ROOT_USERNAME` or `MONGO_ROOT_PASSWORD` after the first `up`, the existing database user keeps its old password. Verified locally: the `mongo` container then turns `unhealthy` and the app does not start. Decide the values before the first start. To change them later, change the password inside MongoDB and in `.env` together; to start over and lose the data, remove the volume deliberately (`docker compose down -v` deletes `mongo_data`: never run it on data you need).

## 4. Build and start

```bash
docker compose up -d --build
docker compose ps
```

Both services should show `healthy` (mongo first, then the app, which waits for it). The first build downloads images and installs packages and takes a few minutes. The app creates the `manager` account on startup if it does not exist, and never changes an existing one.

## 5. Create the employee accounts

```bash
install -d -m 700 -o 1000 -g 1000 secrets      # writable by the container user (uid 1000)
docker compose run --rm --no-deps \
  -e CREDENTIALS_FILE=/out/credentials.txt \
  -v "$PWD/case/seed:/seed:ro" \
  -v "$PWD/secrets:/out" \
  app node server/seed.js /seed/employees.csv
```

The log should end with `seed_done` and `employeesCreated: 25`. The passwords are in `secrets/credentials.txt` (lines `E001,<password>`), never in the log. Running it again creates only accounts that do not exist and never regenerates a password.

- Why the mounts: the image does not contain `employees.csv`, and the credentials must leave the container. `--no-deps` expects `mongo` to be running already.
- **Git Bash on Windows only:** prefix the command with `MSYS_NO_PATHCONV=1`, otherwise `/seed` and `/out` are rewritten to Windows paths and the seed fails with `seed failed: Error`. This does not apply on the Ubuntu instance.
- The Linux `install` line is **untested** (the seed run was tested on Windows with Docker Desktop). If the run fails with a permission error, check the owner of `secrets/`.
- `credentials.txt` holds plaintext passwords. Give each employee only their own line, then delete the file.

## 6. Check it

On the instance:

```bash
curl -s http://localhost:3000/health            # {"status":"ok"}  (process only, not the database)
docker compose logs app | grep -E "db_connected|manager_created|listening"
```

`/health` does **not** test MongoDB. To check the database path, log in:

```bash
curl -s -X POST -H "Content-Type: application/json" -d '{"username":"manager","password":"<MANAGER_PASSWORD>"}' http://localhost:3000/api/auth/login | head -c 120
```

A token means the app reached MongoDB. `AUTH_UNAVAILABLE` means it did not.

From your own computer (this proves the security group is right):

```bash
curl.exe -s http://<ip>:3000/health
```

## 7. The six planted problems

Log in as `manager`, use the sample data, run validation. It must report exactly:

| Rule | Employee | Shifts |
|---|---|---|
| SHORT_REST | E003 | SH013 + SH021 |
| DUPLICATE_ROW | E005 | SH091 |
| OVERLAP | E007 | SH024 + SH025 |
| DATA_BAD_ROW | E010 | SH086 |
| OVERLAP | E012 | SH033 + SH041 |
| ON_LEAVE | E015 | SH098 |

Then open Roster History: the check is listed. Log in as `E003` (password from `credentials.txt`): the portal shows E003's shifts and the SHORT_REST finding only.

Port checks from your own computer (PowerShell): `Test-NetConnection <ip> -Port 3000` succeeds. Port 27017 must not. Port 22 should answer only from your own IP: if it answers from anywhere, the SSH rule is open to 0.0.0.0/0 and must be narrowed.

## 8. Restart and outage checks

```bash
# app restart: data survives
docker compose restart app
# both containers recreated, volume kept (never add -v)
docker compose down && docker compose up -d
# crash recovery: kill the app PROCESS (docker kill is a manual stop and is not restarted)
PID=$(docker inspect -f '{{.State.Pid}}' <project>-app-1); sudo kill -9 $PID
sleep 20; docker compose ps
# database outage: everything protected becomes 503, health stays ok
docker compose stop mongo
curl -s -i http://localhost:3000/api/history          # 401 without a token; 503 AUTH_UNAVAILABLE with a valid one
docker compose start mongo
```

Replace `<project>` with the Compose project name (the clone folder name, for example `roster-checker`).

## 9. If the build runs out of memory

Symptoms: `Killed`, exit code 137, or a frozen SSH session during `npm ci` or `vite build`. Add 2 GB of swap and rebuild:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
free -h                  # Swap should show 2.0Gi
docker compose up -d --build
```

If it still fails, move to a larger instance type. Swap does not survive a reboot unless added to `/etc/fstab`.

## 10. Update, operate, back up

```bash
git pull
docker compose up -d --build     # rebuild and replace the app container; the data volume is kept
docker compose logs -f app       # structured JSON logs, one line per request
docker compose down              # stop and remove containers; named volumes are KEPT
```

Logs hold method, path, status, timing and error names. They never hold passwords, tokens, request bodies, names or the database URI.

### Backup and restore (manual)

```bash
# backup the roster database (accounts and saved checks) to a file on the host
docker compose exec -T mongo sh -c 'mongodump --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin \
  --db roster --archive --gzip' > roster-backup-$(date +%F).archive.gz

# restore (replaces the current contents of those collections)
docker compose exec -T mongo sh -c 'mongorestore --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin \
  --archive --gzip --drop' < roster-backup-2026-11-16.archive.gz
```

Copy the file off the instance (for example `scp`, or to S3); a backup on the same disk does not survive losing the disk. The file contains password hashes and roster data: protect it. There is no schedule: run it by hand (or add a cron job; not done). **Verified locally:** backup of 34 documents, database dropped, restore reported 34 restored, and logins plus history worked again. Not yet run on EC2.

## Verified locally (Docker Desktop on Windows, 2026-11-16)

Run against the real Compose stack with an awkward MongoDB password, on host port 3100 because 3000 was in use on that machine:

- Both containers built; mongo reached `healthy` before the app started; the app logged `db_connected` and `manager_created`.
- Employee seeding created 25 accounts and `credentials.txt`.
- Manager and employee login worked; a wrong password gave `INVALID_CREDENTIALS`.
- The seed check gave `saved: true` and exactly the six findings; history listed it and returned its 6 findings in order; the employee saw only their own finding and got 403 on `/api/history`.
- After `docker compose restart app`, and after `down` then `up` (volume kept), the history entry and both logins survived.
- With `mongo` stopped: `/health` still `ok`; check, history, login: 503 `AUTH_UNAVAILABLE`. After `mongo` started, history returned 200 without restarting the app.
- `mongo` showed `27017/tcp` unpublished; no LAN address answered on 27017; the app container ran as `uid=1000(node)` and could reach `mongo:27017` over the private network.
- A scan of 296 log lines found none of the passwords, the JWT secret or a live token.
- Backup, drop, restore (above) and the changed-password behaviour (section 3).

Not verified: anything on EC2 for this version, Linux bind-mount permissions for `secrets/`, a reboot, real TTL expiry, behaviour under load.

## Earlier results (app-only build, EC2, 2026-11-15)

Ubuntu 24.04, 1 GB RAM with 2 GB swap added. `/health` returned `{"status":"ok"}`; the sample data gave the six findings; a request without a key got 401; port 3000 answered and 27017 did not (nothing was listening); `kill -9` of the app process restarted the container (`restarts=1`); `docker kill` did not restart it (manual stop, exit 137). Port 22 answered from a phone-hotspot address, and the SSH rule sources were not checked, so SSH may be open to everyone. These results belong to the earlier shared-key build.

## Known limits

- HTTP only, no TLS, no domain. Fictional data only; demo passwords are public.
- One instance, one MongoDB container, no load balancer, manual backups only.
- The app connects to MongoDB as the root user (least-privilege user not done).
- `/health` does not check MongoDB.
- Nothing here has been tested after a host reboot.
