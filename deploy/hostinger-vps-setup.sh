#!/usr/bin/env bash
# ============================================================
# Maha (Mahashank Fashion) — Hostinger VPS one-shot setup
# Ubuntu 22.04 / 24.04 · Django + Gunicorn + Nginx + MySQL + SSL
#
# Usage (as root, inside the cloned repo):
#   bash deploy/hostinger-vps-setup.sh
# ============================================================
set -euo pipefail

# ---------------- CONFIG ----------------
DOMAIN="${DOMAIN:-mahashankhfashion.org}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # repo root
APP_NAME="maha"
APP_USER="www-data"
PORT=8000
USE_MYSQL=1   # set to 0 to use sqlite instead (simpler, fine for low traffic)
EMAIL_FOR_SSL="${EMAIL_FOR_SSL:-}"

echo "==> Deploying ${APP_NAME} for ${DOMAIN} from ${APP_DIR}"

# ---------------- 1. System packages ----------------
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
if [ "$USE_MYSQL" = "1" ]; then
  apt-get install -y python3-venv python3-pip nginx git certbot python3-certbot-nginx mariadb-server
else
  apt-get install -y python3-venv python3-pip nginx git certbot python3-certbot-nginx
fi

# ---------------- 2. Python environment ----------------
cd "$APP_DIR"
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip -q
./.venv/bin/pip install -r requirements.txt -q

# ---------------- 3. Secrets / env ----------------
SECRET_KEY="$(./.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(50))')"

if [ "$USE_MYSQL" = "1" ]; then
  DB_NAME="maha"
  DB_USER="maha"
  DB_PASSWORD="$(./.venv/bin/python -c 'import secrets; print(secrets.token_urlsafe(24))')"
  mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';"
  mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost'; FLUSH PRIVILEGES;"
else
  DB_NAME=""
fi

echo ""
echo "==> MISTRAL_API_KEY: paste your key (input hidden), or press Enter to skip for now:"
read -rs MISTRAL_KEY_INPUT || MISTRAL_KEY_INPUT=""
echo ""

cat > .env <<EOF
DJANGO_SECRET_KEY=${SECRET_KEY}
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=${DOMAIN},www.${DOMAIN},localhost,127.0.0.1
DJANGO_CSRF_TRUSTED_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}
DJANGO_CORS_ALLOWED_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}
MISTRAL_API_KEY=${MISTRAL_KEY_INPUT:-}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER:-}
DB_PASSWORD=${DB_PASSWORD:-}
DB_HOST=127.0.0.1
DB_PORT=3306
EOF
chmod 600 .env
echo "==> .env written"

# ---------------- 4. Django: migrate + static ----------------
./.venv/bin/python manage.py migrate --noinput
./.venv/bin/python manage.py collectstatic --noinput

# ---------------- 5. Gunicorn systemd service ----------------
if [ "$USE_MYSQL" = "1" ]; then
  systemctl enable --now mariadb || true
fi

cat > /etc/systemd/system/${APP_NAME}.service <<EOF
[Unit]
Description=${APP_NAME} Django app (gunicorn)
After=network.target
$( [ "$USE_MYSQL" = "1" ] && echo "Requires=mariadb.service" )

[Service]
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=${APP_DIR}/.venv/bin/gunicorn mahashankh_chatbot.wsgi:application \\
    --workers 2 --threads 2 \\
    --bind 127.0.0.1:${PORT} \\
    --access-logfile /var/log/${APP_NAME}-access.log \\
    --error-logfile /var/log/${APP_NAME}-error.log
Restart=always

[Install]
WantedBy=multi-user.target
EOF

touch /var/log/${APP_NAME}-access.log /var/log/${APP_NAME}-error.log
chown ${APP_USER}:${APP_USER} /var/log/${APP_NAME}-*.log
chown -R ${APP_USER}:${APP_USER} "$APP_DIR"

systemctl daemon-reload
systemctl enable --now ${APP_NAME}
systemctl restart ${APP_NAME}

# ---------------- 6. Nginx site ----------------
cat > /etc/nginx/sites-available/${APP_NAME} <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/${APP_NAME}
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ---------------- 7. Firewall ----------------
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH || true
  ufw allow 'Nginx Full' || true
  echo "y" | ufw enable || true
fi

# ---------------- 8. SSL (Let's Encrypt) ----------------
echo ""
echo "==> Site is live on http://${DOMAIN} — attempting SSL certificate"
if [ -n "$EMAIL_FOR_SSL" ]; then
  certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --non-interactive --agree-tos -m "$EMAIL_FOR_SSL" --redirect || echo "!! certbot failed — run it again once DNS points at this server:"
else
  certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email --redirect || echo "!! certbot failed — run again once DNS points at this server"
fi

echo ""
echo "============================================================"
echo " DONE — https://${DOMAIN}"
echo ""
echo " Useful commands:"
echo "   systemctl status ${APP_NAME}        # app status"
echo "   journalctl -u ${APP_NAME} -f        # live app logs"
echo "   tail -f /var/log/${APP_NAME}-error.log"
echo "   nano ${APP_DIR}/.env                # e.g. add MISTRAL_API_KEY later"
echo "   systemctl restart ${APP_NAME}       # after editing .env"
echo "============================================================"
