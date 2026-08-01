#!/usr/bin/env bash
# One-time TLS bootstrap on the VPS. Run from /opt/roomkit, once, before the
# first `docker compose up -d`:
#
#   ./init-letsencrypt.sh you@example.com
#
# Chicken-and-egg: nginx refuses to start without a certificate file, and
# certbot's http-01 challenge needs nginx serving. So we seed a throwaway
# self-signed pair, start nginx, swap in the real certificate, reload.
set -euo pipefail

EMAIL="${1:-}"
DOMAINS=(roomkit.ir www.roomkit.ir livekit.roomkit.ir)
COMPOSE=(docker compose -f compose.prod.yaml)
STAGING="${STAGING:-0}"   # STAGING=1 uses Let's Encrypt's test CA (no rate limit)

if [ -z "$EMAIL" ]; then
  echo "usage: $0 <email-for-expiry-notices>" >&2
  exit 1
fi

echo "==> seeding a self-signed placeholder so nginx can boot"
"${COMPOSE[@]}" run --rm --entrypoint sh certbot -c "
  mkdir -p /etc/letsencrypt/live/roomkit.ir
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/roomkit.ir/privkey.pem \
    -out    /etc/letsencrypt/live/roomkit.ir/fullchain.pem \
    -subj '/CN=localhost'
"

echo "==> starting the edge"
"${COMPOSE[@]}" up -d web

echo "==> requesting the real certificate"
"${COMPOSE[@]}" run --rm --entrypoint sh certbot -c "
  rm -rf /etc/letsencrypt/live/roomkit.ir \
         /etc/letsencrypt/archive/roomkit.ir \
         /etc/letsencrypt/renewal/roomkit.ir.conf
  certbot certonly --webroot -w /var/www/certbot \
    $( [ "$STAGING" = "1" ] && echo --staging ) \
    --email '$EMAIL' --agree-tos --no-eff-email --non-interactive \
    $(printf -- '-d %s ' "${DOMAINS[@]}")
"

echo "==> reloading nginx with the issued certificate"
"${COMPOSE[@]}" exec web nginx -s reload

echo "done — now bring the rest up: ${COMPOSE[*]} up -d"
