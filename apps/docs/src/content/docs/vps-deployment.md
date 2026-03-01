# VPS Deployment

## Recommended topology

- Reverse proxy (Nginx/Caddy)
- `apps/landing` on `127.0.0.1:3000` -> `oneglanse.com`
- `apps/docs` on `127.0.0.1:3002` -> `oneglanse.com/docs`
- `apps/web` on `127.0.0.1:3001` -> `app.oneglanse.com`
- `apps/agent` as internal worker service
- Redis, Postgres, ClickHouse on private network

## 1) Prerequisites checklist

- DNS `A` records point to VPS public IP:
  - `oneglanse.com`
  - `www.oneglanse.com`
  - `app.oneglanse.com`
- Ports `80` and `443` are open on VPS firewall/security group.
- Docker and Docker Compose are installed.

## 2) Bring up application containers

```bash
cd /path/to/onescopeAI
docker compose pull
docker compose up -d
docker compose ps
```

Expected host ports:

- landing -> `127.0.0.1:3000`
- web app -> `127.0.0.1:3001`
- docs -> `127.0.0.1:3002`

## 3) Install Nginx + Certbot (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

## Nginx: `oneglanse.com` (landing + docs)

Use `apps/docs` with `basePath: /docs` and preserve the `/docs` prefix when proxying.

```nginx
# HTTP -> HTTPS
server {
    listen 80;
    server_name oneglanse.com www.oneglanse.com;

    return 301 https://$host$request_uri;
}

# HTTPS
server {
    listen 443 ssl;
    server_name oneglanse.com www.oneglanse.com;

    ssl_certificate /etc/letsencrypt/live/oneglanse.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/oneglanse.com/privkey.pem;

    # Docs (must come before /)
    location /docs/ {
        # no trailing slash -> keeps /docs prefix for Next.js basePath
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Landing
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

## Nginx: `app.oneglanse.com` (dashboard app)

```nginx
# HTTP -> HTTPS
server {
    listen 80;
    server_name app.oneglanse.com;

    return 301 https://$host$request_uri;
}

# HTTPS
server {
    listen 443 ssl;
    server_name app.oneglanse.com;

    ssl_certificate /etc/letsencrypt/live/oneglanse.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/oneglanse.com/privkey.pem;

    # API (tRPC)
    location /api/trpc {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }

    # App
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

## 4) Create and enable Nginx site files

Create `/etc/nginx/sites-available/oneglanse.com` with the `oneglanse.com` block above.

Create `/etc/nginx/sites-available/app.oneglanse.com` with the `app.oneglanse.com` block above.

Then enable:

```bash
sudo ln -sf /etc/nginx/sites-available/oneglanse.com /etc/nginx/sites-enabled/oneglanse.com
sudo ln -sf /etc/nginx/sites-available/app.oneglanse.com /etc/nginx/sites-enabled/app.oneglanse.com
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 5) Issue SSL certificates with Certbot

You can issue one cert covering all hostnames:

```bash
sudo certbot --nginx \
  -d oneglanse.com \
  -d www.oneglanse.com \
  -d app.oneglanse.com
```

After certificate issuance:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 6) Verify HTTPS and routing

```bash
curl -I https://oneglanse.com
curl -I https://oneglanse.com/docs
curl -I https://app.oneglanse.com
curl -I https://app.oneglanse.com/api/trpc
```

## 7) Certbot auto-renew health check

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

## 8) Common gotchas

- With `basePath: /docs`, keep:
  - `location /docs/ { proxy_pass http://127.0.0.1:3002; }`
- Do not add trailing slash to that `proxy_pass` value.
- Keep `app.oneglanse.com` proxied to `127.0.0.1:3001` (not `3000`).
