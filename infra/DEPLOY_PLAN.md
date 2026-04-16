# Deploying to AWS EC2 (Amazon Linux 2023 / Ubuntu)

## Prerequisites

- An EC2 instance (t3.medium or larger recommended)
- Security group with inbound rules:
  - Port 22 (SSH) — your IP only
  - Port 80 (HTTP) — 0.0.0.0/0
  - Port 443 (HTTPS) — 0.0.0.0/0
  - Port 3000 — only if you are not using a reverse proxy (web container)
  - **Do NOT expose** 5432, 6379, or 8000 — they are internal-only
- A domain name pointed at the instance's Elastic IP (required for HTTPS and Better Auth)

---

## 1. Connect to the instance

```bash
ssh -i your-key.pem ec2-user@your-ec2-ip
# Ubuntu: ssh -i your-key.pem ubuntu@your-ec2-ip
```

---

## 2. Install Docker and Docker Compose

**Amazon Linux 2023:**

```bash
sudo dnf update -y
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
newgrp docker

# Docker Compose plugin
DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
mkdir -p $DOCKER_CONFIG/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o $DOCKER_CONFIG/cli-plugins/docker-compose
chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose
docker compose version
```

**Ubuntu:**

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker ubuntu
newgrp docker
```

---

## 3. Clone the repository

```bash
git clone https://github.com/optimalcharb/pdf-ner.git
cd pdf-ner
```

If the repo is private, configure a deploy key or personal access token first.

---

## 4. Configure environment variables

```bash
cp infra/.env.example infra/.env
nano infra/.env
```

Fill in all values:

| Variable | Notes |
|---|---|
| `POSTGRES_PASSWORD` | Postgres superuser password |
| `OWNER_ROLE_PASSWORD` | Used by dbmate migrations |
| `AUTH_ROLE_PASSWORD` | Used by Better Auth |
| `WEB_USER_PASSWORD` | Used by the web app |
| `API_USER_PASSWORD` | Used by the API service |
| `WORKERS_USER_PASSWORD` | Used by the workers service |
| `BETTER_AUTH_SECRET` | Run `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Must be your public HTTPS URL, e.g. `https://yourdomain.com` |
| `RESEND_API_KEY` | Resend email service API key |
| `FROM_EMAIL` | Sender email for transactional emails |
| `MY_EMAIL` | Admin notification email |
| `UPLOADTHING_TOKEN` | UploadThing file upload token |
| `STRIPE_SECRET_KEY` | Stripe secret key (injected into web) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Baked into the web bundle at build time — use the live key |

Also create env files for the API and workers services (used by docker-compose `env_file`):

```bash
cp api/.env.local.example api/.env
nano api/.env

cp workers/.env.local.example workers/.env
nano workers/.env
```

The API env file requires: `API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `STRIPE_SECRET_KEY`.

The workers env file requires: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`, and `STRIPE_SECRET_KEY`. The `WORKERS_DATABASE_URL` and `REDIS_URL` are injected by docker-compose — do not duplicate them in the `.env` file.

---

## 5. Build and start all services

Run from the repo root:

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
```

This will:
1. Build the `db` image (PostgreSQL 18 + dbmate v2.24.2)
2. Build the `web` image (Bun build → Node.js runtime, non-root)
3. Build the `api` and `worker` images (uv v0.9.7, non-root)
4. Create two Docker networks: `frontend` (public-facing) and `backend` (internal-only, no host access)
5. On **first start**, `db` automatically runs `init/01_roles.sh` (creates roles and schemas) then `init/02_migrate.sh` (runs all numbered migrations + better-auth migration)
6. Start all services

> **Networking**: Only `web` (port 3000) is published to all interfaces. The `api` (port 8000) is bound to `127.0.0.1` only. Database and Redis are not published to the host — they are accessible only over the internal Docker network.

Check that everything is running:

```bash
docker compose -f infra/docker-compose.yml ps
docker compose -f infra/docker-compose.yml logs -f
```

---

## 6. (Recommended) Reverse proxy with Nginx + HTTPS

Install Nginx and Certbot:

```bash
# Amazon Linux 2023
sudo dnf install -y nginx
sudo systemctl enable --now nginx

sudo dnf install -y python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Create `/etc/nginx/conf.d/dokumen.conf`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Optional: expose the API through Nginx
    location /api/ {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 7. Updating the application

Pull the latest code and rebuild only changed services:

```bash
git pull
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build web
```

To rebuild all services:

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
```

> **Database migrations**: After a `git pull` that includes new migration files, the db container's init scripts will **not** re-run (they only execute on first start against a fresh data volume). Run new migrations manually:
>
> ```bash
> docker compose -f infra/docker-compose.yml --env-file infra/.env exec db \
>   sh -c 'DATABASE_URL="postgres://owner_role:${OWNER_ROLE_PASSWORD}@127.0.0.1:5432/dokumen?sslmode=disable" \
>     dbmate --migrations-dir=/migrations up'
> ```

---

## 8. Useful commands

```bash
# View logs for a specific service
docker compose -f infra/docker-compose.yml logs -f web

# Open a psql shell (db is not exposed to host — use exec)
docker compose -f infra/docker-compose.yml --env-file infra/.env exec db \
  psql -U postgres -d dokumen

# Restart a single service without downtime
docker compose -f infra/docker-compose.yml --env-file infra/.env restart web

# Stop everything
docker compose -f infra/docker-compose.yml down

# Stop and delete the database volume (DESTRUCTIVE — all data lost)
docker compose -f infra/docker-compose.yml down -v
```

---

## Architecture on EC2

```
Internet → Nginx (80/443) → web container (3000)  [frontend + backend networks]
                          → api container (8000)   [127.0.0.1 only, frontend + backend networks]

              ┌─── backend network (internal, no host access) ───┐
              │                                                   │
web  ──→  db container (5432)                                     │
api  ──→  db container (5432)                                     │
api  ──→  redis container (6379)                                  │
worker →  db container (5432)                                     │
worker →  redis container (6379)                                  │
              └───────────────────────────────────────────────────┘
```

- `db` and `redis` are on the `backend` network only — not published to the host.
- `api` is on both `frontend` and `backend` — bound to `127.0.0.1:8000` so only Nginx (or local processes) can reach it.
- `web` is on both networks — published on `0.0.0.0:3000` for Nginx to proxy.
- `worker` is on `backend` only — no ports published.
- All containers communicate over Docker's internal `backend` network using service names (`db`, `redis`, etc.) as hostnames.
