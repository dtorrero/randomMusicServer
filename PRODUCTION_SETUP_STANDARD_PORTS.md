# Production Setup with Standard Ports (80/443)

This guide explains how to set up your Random Music Server for production using standard HTTP/HTTPS ports (80 and 443) with Let's Encrypt SSL certificates.

## Overview

This setup modifies the existing SSL configuration to use:
- **Port 80**: HTTP traffic (redirects to HTTPS)
- **Port 443**: HTTPS traffic (SSL/TLS encrypted)
- **Port 8000**: Internal application port (not exposed externally)

The architecture includes:
- **Nginx**: Reverse proxy for SSL termination (with `NET_BIND_SERVICE` capability)
- **Certbot**: Automated certificate management
- **Random Music Server**: Your application backend

## Prerequisites

1. **Domain name** pointing to your server's public IP address
2. **Ports 80 and 443** accessible from the internet (firewall rules configured)
3. **Docker and Docker Compose** installed
4. Your music directory path configured

## Step-by-Step Setup

### Step 1: Update Configuration Files

1. **Update the music directory path** in `docker-compose.ssl-standard-ports.yml`:
   ```yaml
   volumes:
     - /path/to/your/music:/music:ro  # Change this to your actual music path
     - ./data:/data
   ```

### Step 2: Configure Firewall

Ensure your firewall allows traffic on ports 80 and 443:

**For UFW (Ubuntu):**
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

**For firewalld (CentOS/RHEL):**
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### Step 3: Stop Any Existing Services

If you have the non-SSL or non-standard port SSL setup running, stop it first:

```bash
# Stop non-SSL setup
docker compose -f docker-compose.yml down

# Stop non-standard port SSL setup (if running)
docker compose -f docker-compose.ssl.yml down
```

### Step 4: Run Initial Certificate Setup

Run the initialization script with your domain and email:

```bash
./init-letsencrypt-standard-ports.sh your-domain.com your-email@example.com
```

**For testing first** (recommended), use the staging server to avoid rate limits:
```bash
./init-letsencrypt-standard-ports.sh your-domain.com your-email@example.com 1
```

The script will:
1. Create necessary directories
2. Download TLS parameters
3. Generate a temporary dummy certificate
4. Start Nginx with HTTP-only config
5. Request real certificates from Let's Encrypt
6. Switch to HTTPS configuration
7. Reload Nginx

### Step 5: Start All Services

Once certificates are obtained, start all services:

```bash
docker compose -f docker-compose.ssl-standard-ports.yml up -d
```

### Step 6: Verify SSL Setup

Test your setup:

**HTTP (should redirect to HTTPS):**
```bash
curl -I http://your-domain.com
```

**HTTPS:**
```bash
curl -I https://your-domain.com
```

Or visit in your browser:
- `http://your-domain.com` (should redirect to HTTPS)
- `https://your-domain.com` (secure connection)

## Managing the Services

### Start Services
```bash
docker compose -f docker-compose.ssl-standard-ports.yml up -d
```

### Stop Services
```bash
docker compose -f docker-compose.ssl-standard-ports.yml down
```

### View Logs
```bash
# All services
docker compose -f docker-compose.ssl-standard-ports.yml logs -f

# Specific service
docker compose -f docker-compose.ssl-standard-ports.yml logs -f nginx
docker compose -f docker-compose.ssl-standard-ports.yml logs -f certbot
docker compose -f docker-compose.ssl-standard-ports.yml logs -f random-music
```

### Restart Nginx
```bash
docker compose -f docker-compose.ssl-standard-ports.yml restart nginx
```

## Certificate Renewal

Certificates are **automatically renewed** by the Certbot container every 12 hours. No manual intervention needed.

### Manual Renewal

If you need to manually renew certificates:

```bash
./renew-certificates-standard-ports.sh
```

## Troubleshooting

### Port 80/443 Already in Use

If ports 80 or 443 are already in use on your host:

```bash
# Check what's using the ports
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting services (e.g., Apache, existing nginx)
sudo systemctl stop apache2
sudo systemctl stop nginx
```

### Nginx Won't Start

**Test configuration:**
```bash
docker compose -f docker-compose.ssl-standard-ports.yml exec nginx nginx -t
```

**Check certificate paths:**
```bash
ls -la certbot/conf/live/your-domain.com/
```

### Certificate Request Fails

**Check DNS:**
```bash
dig +short your-domain.com
```

**Check port accessibility from outside:**
```bash
# From another machine
curl http://your-domain.com/.well-known/acme-challenge/test
```

**Check logs:**
```bash
docker compose -f docker-compose.ssl-standard-ports.yml logs nginx
docker compose -f docker-compose.ssl-standard-ports.yml logs certbot
```

## File Structure

The standard ports setup adds these files:

```
randomMusicServer/
├── docker-compose.ssl-standard-ports.yml          # Docker Compose with SSL on ports 80/443
├── init-letsencrypt-standard-ports.sh             # Initial certificate setup script
├── renew-certificates-standard-ports.sh           # Manual renewal script
├── PRODUCTION_SETUP_STANDARD_PORTS.md             # This guide
├── nginx/
│   ├── nginx.conf                                 # Main Nginx configuration
│   └── conf.d-standard-ports/
│       ├── default.conf                           # SSL-enabled site config (80/443)
│       └── default-http-only.conf                 # Temporary HTTP-only config
├── certbot/
│   ├── conf/                                      # Certificate storage (auto-created)
│   └── www/                                       # ACME challenge files (auto-created)
└── data/                                          # Application data (existing)
```

## Security Considerations

### Nginx Running with NET_BIND_SERVICE

The nginx container runs with `NET_BIND_SERVICE` capability to bind to privileged ports (< 1024). This is necessary for ports 80/443 but introduces a slight security consideration. The nginx container runs as non-root user inside the container, but with this capability.

### SSL/TLS Configuration

The Nginx configuration includes modern security settings:
- TLS 1.2 and 1.3 only
- Strong cipher suites
- HSTS headers (preload enabled)
- OCSP stapling
- Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)

### Certificate Storage

Certificates are stored in `./certbot/conf/` and should be:
- Backed up regularly
- Not committed to version control (already in .gitignore)
- Protected with appropriate file permissions

## Migration from Non-Standard Ports (8080/8443)

If you're migrating from the non-standard port SSL setup:

1. Stop the old setup:
   ```bash
   docker compose -f docker-compose.ssl.yml down
   ```

2. Backup your certificates (optional):
   ```bash
   tar -czf certbot-backup-$(date +%Y%m%d).tar.gz certbot/
   ```

3. Run the standard port initialization:
   ```bash
   ./init-letsencrypt-standard-ports.sh your-domain.com your-email@example.com
   ```

4. Update any bookmarks or links to use HTTPS without port numbers

## Quick Reference

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Nginx | 80 | HTTP | Redirects to HTTPS, ACME challenges |
| Nginx | 443 | HTTPS | SSL-encrypted traffic |
| Random Music | 8000 | HTTP | Internal only (not exposed) |

**Important Commands:**
```bash
# Initial setup
./init-letsencrypt-standard-ports.sh your-domain.com your-email@example.com

# Start services
docker compose -f docker-compose.ssl-standard-ports.yml up -d

# View logs
docker compose -f docker-compose.ssl-standard-ports.yml logs -f

# Manual renewal
./renew-certificates-standard-ports.sh

# Test Nginx config
docker compose -f docker-compose.ssl-standard-ports.yml exec nginx nginx -t

# Reload Nginx
docker compose -f docker-compose.ssl-standard-ports.yml exec nginx nginx -s reload
```

## Support

For issues specific to:
- **Let's Encrypt**: https://community.letsencrypt.org/
- **Certbot**: https://certbot.eff.org/docs/
- **Nginx**: https://nginx.org/en/docs/
- **Random Music Server**: Check the main README.md
