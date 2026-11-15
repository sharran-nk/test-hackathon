# Deploy to an Ubuntu EC2 instance

Docker Compose on one EC2 instance. These steps were written from the local container run; the EC2 run itself has not been done yet. Record the result in the README once it has.

The demo is plain HTTP, so it must only ever hold the fictional seed data (see the README warning). The access key is a throwaway used nowhere else.

## 0. Before you start (AWS console)

- Launch Ubuntu 22.04 or 24.04 LTS. Use at least 2 GB of RAM (for example `t3.small`). A 1 GB instance (`t2.micro`) can run out of memory during the build, see section 8.
- Disk: 12 GB or more.
- Security group, inbound rules only:
  - TCP 22 from **your IP only** (not 0.0.0.0/0).
  - TCP 3000 from anywhere (this is the app).
  - Nothing else. 27017 (MongoDB, from Milestone 4) must never be opened.
- Note the public IPv4 address, written below as `<ip>`.

## 1. Connect and install Docker

```bash
ssh -i <your-key>.pem ubuntu@<ip>

sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
exit        # log out and back in so the group change applies
ssh -i <your-key>.pem ubuntu@<ip>

docker --version
docker compose version
```

If `docker-compose-v2` is not found on your Ubuntu version, install Docker from Docker's official apt repository instead (docs.docker.com/engine/install/ubuntu) and install the `docker-compose-plugin` package.

## 2. Clone

```bash
git clone <repository-url> roster-checker
cd roster-checker
```

## 3. Create `.env` with a temporary random key

```bash
cp .env.example .env
KEY=$(openssl rand -hex 24)
sed -i "s/^ACCESS_KEY=.*/ACCESS_KEY=$KEY/" .env
chmod 600 .env
echo "$KEY"        # copy this; it is the key you type into the app
```

`.env` is in `.gitignore` and `.dockerignore`, so it is never committed and never copied into the image. Keep `PORT=3000`: the Compose file and the health check use it. Delete the key and the instance when the hackathon is over.

## 4. Build and start

```bash
docker compose up -d --build
docker compose ps
```

`docker compose ps` should show the app as `Up ... (healthy)` within about 15 seconds of the build finishing. The first build downloads images and installs packages, so it takes a few minutes.

## 5. Check `/health`

On the instance:

```bash
curl -s http://localhost:3000/health
```

Expected: `{"status":"ok"}`

From your own computer (this proves the security group is right):

```bash
curl.exe -s http://<ip>:3000/health
```

## 6. Open the dashboard and load the sample data

1. Open  in a browser. The workforce portal landing page appears.
2. Choose the manager sign-in. The password is the access key from step 3.
3. On the upload screen click **Use sample data**, then **Run validation**.

The HTTP-only notice required by the Milestone 3 acceptance line is not in the UI yet. Add it (or note it as a gap in the README) before hand-in.

## 7. Check the six problems

The check must report exactly these six findings and nothing else:

| Rule | Employee | Shifts |
|---|---|---|
| SHORT_REST | E003 | SH013 + SH021 |
| DUPLICATE_ROW | E005 | SH091 |
| OVERLAP | E007 | SH024 + SH025 |
| DATA_BAD_ROW | E010 | SH086 |
| OVERLAP | E012 | SH033 + SH041 |
| ON_LEAVE | E015 | SH098 |

Also check the 401 from your own computer (no key must be refused):

```bash
curl.exe -s -i -X POST -H "Content-Type: application/json" -d "{}" http://<ip>:3000/api/check
```

Expected: `HTTP/1.1 401 Unauthorized`.

Restart check (acceptance test for the milestone):

```bash
docker kill $(docker compose ps -q app)
sleep 15
docker compose ps        # should be Up again: restart policy is unless-stopped
```

Port check from your own computer: 3000 answers, and 22 and 27017 do not answer from other addresses.

## 8. If the build runs out of memory

Symptoms: the build stops with `Killed`, exit code 137, or the SSH session freezes during `npm ci` or `vite build`.

Fix, in order:

1. Add 2 GB of swap, then build again:

   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   free -h                  # Swap should show 2.0Gi
   docker compose up -d --build
   ```

2. If it still fails, stop the instance, change the type to `t3.small` or larger, start it again (the public IP may change), then rebuild.
3. Last resort: build the image on your own machine, push it to a registry, and change `build: .` to `image:` in `docker-compose.yml`. Avoid this unless needed, because it adds a registry to explain.

Swap does not survive a reboot unless it is added to `/etc/fstab`. That is not needed for a short demo.

## 9. Update and operate

```bash
git pull
docker compose up -d --build     # rebuild and replace the container
docker compose logs -f app       # structured JSON logs, one line per request
docker compose down              # stop and remove the container
```

Logs hold method, path, status and timing only. They never hold the key, request bodies or names.

## Known limits

- HTTP only, no TLS, no domain. Only fictional data may be used.
- One instance, no load balancer, no backups.
- MongoDB is not part of this deploy yet (Milestone 4). Until then results are not saved.
