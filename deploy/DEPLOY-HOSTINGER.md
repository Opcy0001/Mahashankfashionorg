# Deploying Maha to Hostinger VPS — mahashankhfashion.org

> Hostinger's shared/Premium hosting **cannot run Django** (no Python, no root).
> Python apps require a **Hostinger VPS** plan. KVM 1 (~$5/mo) is enough.

## What gets installed

| Piece     | Choice                              |
|-----------|-------------------------------------|
| App       | Django + Gunicorn (systemd, 2 workers) |
| Web server| Nginx (reverse proxy → 127.0.0.1:8000) |
| Database  | MariaDB (local, `mahashankh_chatbot` schema via migrations) |
| HTTPS     | Let's Encrypt via certbot           |

## Step 0 — Buy & point DNS

1. Buy a **Hostinger VPS** (KVM 1+), choose **Ubuntu 22.04/24.04** template.
2. hPanel → VPS → **DNS / Manage zone** (or your domain's DNS panel):
   - `mahashankhfashion.org`     → **A** → `<VPS IP>`
   - `www.mahashankhfashion.org` → **A** → `<VPS IP>`
3. Wait for DNS to propagate (check `ping mahashankhfashion.org` or whatsmydns.net).

## Step 1 — SSH in and get the code

```bash
ssh root@<VPS IP>

# Get your code (repo is private — use a fine-grained token with read-only Contents access):
git clone https://<TOKEN>@github.com/Opcy0001/Mahashankfashionorg.git /opt/maha
cd /opt/maha
```

## Step 2 — Run the setup script

```bash
bash deploy/hostinger-vps-setup.sh
```

It will:
- install Nginx, Python venv, MariaDB, certbot
- create the `maha` MySQL database + user (auto-generated strong password)
- generate a fresh Django `SECRET_KEY`
- write `/opt/maha/.env` (mode 600) with all values
- run `migrate` + `collectstatic`
- create a `maha` systemd service (auto-start on boot, auto-restart on crash)
- configure Nginx for your domain
- attempt a free Let's Encrypt SSL certificate for both apex + www

When it prompts, paste your **Mistral API key** (hidden input) or press Enter to add it later.

## Step 3 — Verify

```bash
systemctl status maha                      # should show active (running)
curl -I http://localhost/                  # via nginx
curl -I https://mahashankhfashion.org/     # after SSL
```

Then open **https://mahashankhfashion.org** in your browser.

## Common operations

```bash
# After editing .env (e.g. adding Mistral key later):
nano /opt/maha/.env && systemctl restart maha

# App logs:
journalctl -u maha -f
tail -f /var/log/maha-error.log

# Updating the site after pushing to GitHub:
cd /opt/maha && git pull && \
  .venv/bin/pip install -r requirements.txt && \
  .venv/bin/python manage.py migrate --noinput && \
  .venv/bin/python manage.py collectstatic --noinput && \
  systemctl restart maha
```

## Notes

- `.env` lives only on the server (never in git) — settings.py reads everything from it.
- WhiteNoise serves static files — no extra config needed.
- The chatbot falls back to a friendly "offline" message if `MISTRAL_API_KEY` is empty — add it in `.env` and `systemctl restart maha`.
- App auto-starts on reboot (systemd `enable`).
