#!/bin/bash

# Initialize Let's Encrypt certificates for non-standard ports
# This script sets up SSL certificates using Certbot with HTTP-01 challenge on port 8080

set -e

# Configuration
DOMAIN="${1:-your-domain.com}"
EMAIL="${2:-your-email@example.com}"
STAGING="${3:-0}"  # Set to 1 for testing with staging server

COMPOSE_FILE="docker-compose.ssl.yml"
DATA_PATH="./certbot"
NGINX_CONF_PATH="./nginx/conf.d"

echo "### Initializing Let's Encrypt for $DOMAIN ###"
echo ""

# Validate domain
if [ "$DOMAIN" = "your-domain.com" ]; then
    echo "Error: Please provide your domain name as the first argument"
    echo "Usage: ./init-letsencrypt.sh your-domain.com your-email@example.com [staging]"
    exit 1
fi

# Validate email
if [ "$EMAIL" = "your-email@example.com" ]; then
    echo "Error: Please provide your email address as the second argument"
    echo "Usage: ./init-letsencrypt.sh your-domain.com your-email@example.com [staging]"
    exit 1
fi

# Create necessary directories
echo "### Creating directories ###"
mkdir -p "$DATA_PATH/conf/live/$DOMAIN"
mkdir -p "$DATA_PATH/www"
mkdir -p "$NGINX_CONF_PATH"

# Check if certificates already exist
if [ -d "$DATA_PATH/conf/live/$DOMAIN" ] && [ -f "$DATA_PATH/conf/live/$DOMAIN/fullchain.pem" ]; then
    echo "### Existing certificates found for $DOMAIN ###"
    read -p "Do you want to replace them? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing certificates"
        exit 0
    fi
    echo "Removing existing certificates..."
    rm -rf "$DATA_PATH/conf/live/$DOMAIN"
fi

# Download recommended TLS parameters if they don't exist
if [ ! -e "$DATA_PATH/conf/options-ssl-nginx.conf" ] || [ ! -e "$DATA_PATH/conf/ssl-dhparams.pem" ]; then
    echo "### Downloading recommended TLS parameters ###"
    mkdir -p "$DATA_PATH/conf"
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$DATA_PATH/conf/options-ssl-nginx.conf"
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$DATA_PATH/conf/ssl-dhparams.pem"
    echo
fi

# Create dummy certificate to allow nginx to start
echo "### Creating dummy certificate for $DOMAIN ###"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
mkdir -p "$DATA_PATH/conf/live/$DOMAIN"
docker compose -f $COMPOSE_FILE run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:4096 -days 1\
    -keyout '$CERT_PATH/privkey.pem' \
    -out '$CERT_PATH/fullchain.pem' \
    -subj '/CN=localhost'" certbot
echo

# Ensure HTTP-only config is in place for initial setup
echo "### Setting up HTTP-only configuration ###"
if [ -f "$NGINX_CONF_PATH/default.conf" ]; then
    mv "$NGINX_CONF_PATH/default.conf" "$NGINX_CONF_PATH/default.conf.ssl-backup"
fi
cp "$NGINX_CONF_PATH/default-http-only.conf" "$NGINX_CONF_PATH/default.conf"

# Start nginx
echo "### Starting nginx ###"
docker compose -f $COMPOSE_FILE up -d nginx
echo

# Wait for nginx to be ready
echo "### Waiting for nginx to be ready ###"
sleep 5

# Delete dummy certificate
echo "### Deleting dummy certificate for $DOMAIN ###"
docker compose -f $COMPOSE_FILE run --rm --entrypoint "\
  rm -rf /etc/letsencrypt/live/$DOMAIN && \
  rm -rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -rf /etc/letsencrypt/renewal/$DOMAIN.conf" certbot
echo

# Request Let's Encrypt certificate
echo "### Requesting Let's Encrypt certificate for $DOMAIN ###"

# Determine if we should use staging
STAGING_ARG=""
if [ $STAGING != "0" ]; then
    STAGING_ARG="--staging"
    echo "Using Let's Encrypt staging server (test mode)"
fi

# Run certbot with HTTP-01 challenge on port 8080
docker compose -f $COMPOSE_FILE run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $STAGING_ARG \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d $DOMAIN" certbot
echo

# Restore SSL configuration
echo "### Restoring SSL configuration ###"
if [ -f "$NGINX_CONF_PATH/default.conf.ssl-backup" ]; then
    mv "$NGINX_CONF_PATH/default.conf.ssl-backup" "$NGINX_CONF_PATH/default.conf"
else
    echo "Warning: SSL backup config not found, you may need to manually update nginx config"
fi

# Update nginx config with actual domain
echo "### Updating nginx configuration with domain ###"
sed -i "s/YOUR_DOMAIN/$DOMAIN/g" "$NGINX_CONF_PATH/default.conf"

# Reload nginx
echo "### Reloading nginx ###"
docker compose -f $COMPOSE_FILE exec nginx nginx -s reload

echo ""
echo "### SSL certificates successfully obtained! ###"
echo "Your site should now be accessible at:"
echo "  - HTTP:  http://$DOMAIN:8080 (redirects to HTTPS)"
echo "  - HTTPS: https://$DOMAIN:8443"
echo ""
echo "Certificates will auto-renew via the certbot container."
echo ""
