# Manual Fix Instructions for Nginx SSL Setup

Follow these steps manually to fix the nginx configuration and complete SSL setup.

## Step 1: Check Current Status

```bash
# Check running containers
podman ps

# Check nginx logs for error
podman logs nginx-ssl-proxy

# Test local access (should fail currently)
curl -I http://localhost/.well-known/acme-challenge/test
```

## Step 2: Fix Nginx Configuration

### 2.1 Edit the nginx config file:
```bash
nano nginx/conf.d-standard-ports/default.conf
```

### 2.2 Find and fix these issues:

**Issue 1: Wrong upstream hostname** (around line 63)
```nginx
# CHANGE FROM:
proxy_pass http://$upstream;

# CHANGE TO:
proxy_pass http://random-music-server:8000;
```

**Issue 2: Remove resolver lines** (lines 61-62)
Delete these two lines:
```nginx
resolver 127.0.0.11 valid=30s;  # Docker/Podman internal DNS
set $upstream random-music:8000;
```

**Issue 3: Update domain** (around line 19-20)
```nginx
# CHANGE FROM:
ssl_certificate /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem;

# CHANGE TO:
ssl_certificate /etc/letsencrypt/live/randomplayer.duckdns.org/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/randomplayer.duckdns.org/privkey.pem;
```

**Issue 4: Fix HTTP2 syntax** (around line 18)
```nginx
# CHANGE FROM:
listen 443 ssl http2;

# CHANGE TO:
listen 443 ssl;
    http2 on;
```

### 2.3 Save and exit the editor (Ctrl+X, then Y, then Enter in nano)

## Step 3: Remove Conflicting Config File

```bash
# Rename default-http-only.conf so nginx doesn't load it
mv nginx/conf.d-standard-ports/default-http-only.conf nginx/conf.d-standard-ports/default-http-only.conf.backup
```

## Step 4: Test Nginx Configuration

```bash
# Test the config
podman run --rm -v $(pwd)/nginx/conf.d-standard-ports:/etc/nginx/conf.d:ro docker.io/nginx:alpine nginx -t
```

If you see "configuration file /etc/nginx/nginx.conf test is successful", proceed.

## Step 5: Restart Nginx

```bash
# Stop and remove the nginx container
podman stop nginx-ssl-proxy
podman rm nginx-ssl-proxy

# Start nginx with updated config
podman-compose -f docker-compose.ssl-standard-ports.yml up -d nginx
```

## Step 6: Verify Nginx is Working

```bash
# Wait a moment
sleep 2

# Test local access
curl -I http://localhost/.well-known/acme-challenge/test

# Check nginx logs
podman logs nginx-ssl-proxy --tail=10
```

If you get a response (even 404 is OK) instead of "Connection reset by peer", nginx is working.

## Step 7: Complete SSL Setup

Once nginx is serving on port 80:

```bash
# Run the SSL setup script again
./init-letsencrypt-standard-ports-podman.sh randomplayer.duckdns.org david.torrero@gmail.com 1
```

## Step 8: Start All Services

```bash
# Start all services
podman-compose -f docker-compose.ssl-standard-ports.yml up -d

# Verify all containers are running
podman-compose -f docker-compose.ssl-standard-ports.yml ps
```

## Step 9: Test HTTPS Access

```bash
# Test HTTPS (may fail if certificates not yet issued)
curl -I https://randomplayer.duckdns.org

# Check certificates
ls -la certbot/conf/live/randomplayer.duckdns.org/
```

## Troubleshooting

### If nginx still fails:
```bash
# Check container IP
podman inspect random-music-server | grep -i ipaddress

# If you get an IP like 10.89.6.2, use it in nginx config:
# Change: proxy_pass http://random-music-server:8000;
# To:     proxy_pass http://10.89.6.2:8000;
```

### If SSL setup still fails:
```bash
# Check if port 80 is accessible from internet
# Visit in browser: http://randomplayer.duckdns.org

# Check certbot logs
podman logs certbot
```

## Summary of Changes Made

1. **Fixed upstream hostname**: `random-music` → `random-music-server`
2. **Removed DNS resolver lines**: Not needed with container name
3. **Updated domain**: `YOUR_DOMAIN` → `randomplayer.duckdns.org`
4. **Fixed HTTP2 syntax**: Separated `listen` and `http2` directives
5. **Removed conflicting config**: Renamed `default-http-only.conf`

These changes should resolve the "host not found in upstream" error and allow nginx to start properly.
