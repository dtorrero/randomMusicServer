# SSL Setup with Certbot (Non-Standard Ports)

This guide explains how to add SSL/TLS certificates to your Random Music Server using Let's Encrypt and Certbot, configured for non-standard ports (8080 for HTTP, 8443 for HTTPS).

## Overview

Since ports 80 and 443 are not available, this setup uses:
- **Port 8080**: HTTP traffic (redirects to HTTPS)
- **Port 8443**: HTTPS traffic (SSL/TLS encrypted)
- **Port 8000**: Internal application port (not exposed externally)

The architecture includes:
- **Nginx**: Reverse proxy for SSL termination
- **Certbot**: Automated certificate management
- **Random Music Server**: Your application backend

## Prerequisites

1. **Domain name** pointing to your server's IP address
2. **Ports 8080 and 8443** accessible from the internet (firewall rules configured)
3. **Docker and Docker Compose** installed
4. Your music directory path configured

## File Structure

The SSL setup adds these new files (your existing files remain unchanged):

```
randomMusicServer/
├── docker-compose.ssl.yml          # Docker Compose with SSL services
├── init-letsencrypt.sh             # Initial certificate setup script
├── renew-certificates.sh           # Manual renewal script
├── nginx/
│   ├── nginx.conf                  # Main Nginx configuration
│   └── conf.d/
│       ├── default.conf            # SSL-enabled site config
│       └── default-http-only.conf  # Temporary HTTP-only config
├── certbot/
│   ├── conf/                       # Certificate storage (auto-created)
│   └── www/                        # ACME challenge files (auto-created)
└── data/                           # Application data (existing)
```

## Setup Instructions

### Step 1: Update docker-compose.ssl.yml

Edit `docker-compose.ssl.yml` and update the music directory path:

```yaml
volumes:
  - /path/to/your/music:/music:ro  # Change this to your actual music path
  - ./data:/data
```

### Step 2: Configure Your Domain

Ensure your domain DNS A record points to your server's public IP address.

You can verify with:
```bash
dig +short your-domain.com
```

### Step 3: Make Scripts Executable

```bash
chmod +x init-letsencrypt.sh
chmod +x renew-certificates.sh
```

### Step 4: Run Initial Certificate Setup

Run the initialization script with your domain and email:

```bash
./init-letsencrypt.sh your-domain.com your-email@example.com
```

**For testing first** (recommended), use the staging server to avoid rate limits:
```bash
./init-letsencrypt.sh your-domain.com your-email@example.com 1
```

The script will:
1. Create necessary directories
2. Download TLS parameters
3. Generate a temporary dummy certificate
4. Start Nginx with HTTP-only config
5. Request real certificates from Let's Encrypt
6. Switch to HTTPS configuration
7. Reload Nginx

### Step 5: Verify SSL Setup

Once complete, test your setup:

**HTTP (should redirect to HTTPS):**
```bash
curl -I http://your-domain.com:8080
```

**HTTPS:**
```bash
curl -I https://your-domain.com:8443
```

Or visit in your browser:
- `http://your-domain.com:8080` (redirects to HTTPS)
- `https://your-domain.com:8443` (secure connection)

## Managing the Services

### Start Services
```bash
docker compose -f docker-compose.ssl.yml up -d
```

### Stop Services
```bash
docker compose -f docker-compose.ssl.yml down
```

### View Logs
```bash
# All services
docker compose -f docker-compose.ssl.yml logs -f

# Specific service
docker compose -f docker-compose.ssl.yml logs -f nginx
docker compose -f docker-compose.ssl.yml logs -f certbot
docker compose -f docker-compose.ssl.yml logs -f random-music
```

### Restart Nginx
```bash
docker compose -f docker-compose.ssl.yml restart nginx
```

## Certificate Renewal

Certificates are **automatically renewed** by the Certbot container every 12 hours. No manual intervention needed.

### Manual Renewal

If you need to manually renew certificates:

```bash
./renew-certificates.sh
```

Or directly:
```bash
docker compose -f docker-compose.ssl.yml run --rm certbot renew
docker compose -f docker-compose.ssl.yml exec nginx nginx -s reload
```

## Troubleshooting

### Certificate Request Fails

**Check DNS:**
```bash
dig +short your-domain.com
```

**Check port accessibility:**
```bash
# From another machine
curl http://your-domain.com:8080/.well-known/acme-challenge/test
```

**Check Nginx logs:**
```bash
docker compose -f docker-compose.ssl.yml logs nginx
```

**Check Certbot logs:**
```bash
docker compose -f docker-compose.ssl.yml logs certbot
```

### Nginx Won't Start

**Test configuration:**
```bash
docker compose -f docker-compose.ssl.yml exec nginx nginx -t
```

**Check certificate paths:**
```bash
ls -la certbot/conf/live/your-domain.com/
```

### Port Already in Use

**Check what's using the port:**
```bash
sudo lsof -i :8080
sudo lsof -i :8443
```

**Stop conflicting services or change ports in docker-compose.ssl.yml**

### Rate Limits

Let's Encrypt has rate limits:
- 50 certificates per registered domain per week
- 5 failed validation attempts per hour

**Solution:** Use staging server for testing:
```bash
./init-letsencrypt.sh your-domain.com your-email@example.com 1
```

## Security Considerations

### Firewall Configuration

Ensure your firewall allows:
```bash
# UFW example
sudo ufw allow 8080/tcp
sudo ufw allow 8443/tcp

# iptables example
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 8443 -j ACCEPT
```

### SSL/TLS Configuration

The Nginx configuration includes:
- TLS 1.2 and 1.3 only
- Strong cipher suites
- HSTS headers
- OCSP stapling
- Session caching

### Certificate Storage

Certificates are stored in `./certbot/conf/` and should be:
- Backed up regularly
- Not committed to version control (already in .gitignore)
- Protected with appropriate file permissions

## Advanced Configuration

### Custom Nginx Settings

Edit `nginx/conf.d/default.conf` to customize:
- Server names
- Security headers
- Proxy settings
- Timeouts
- Buffer sizes

After changes:
```bash
docker compose -f docker-compose.ssl.yml exec nginx nginx -t
docker compose -f docker-compose.ssl.yml exec nginx nginx -s reload
```

### Multiple Domains

To add more domains, edit `nginx/conf.d/default.conf` and add to `server_name`:

```nginx
server_name domain1.com domain2.com;
```

Then obtain certificates for all domains:
```bash
docker compose -f docker-compose.ssl.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  -d domain1.com -d domain2.com
```

### Wildcard Certificates

Wildcard certificates require DNS-01 challenge (not HTTP-01). This is more complex and requires DNS provider API access. Consult Certbot documentation for your DNS provider.

## Switching Between Configurations

### Use SSL Setup
```bash
docker compose -f docker-compose.ssl.yml up -d
```

### Use Original Setup (No SSL)
```bash
docker compose -f docker-compose.yml up -d
```

Both configurations can coexist without conflicts.

## Backup and Restore

### Backup Certificates
```bash
tar -czf certbot-backup-$(date +%Y%m%d).tar.gz certbot/conf/
```

### Restore Certificates
```bash
tar -xzf certbot-backup-YYYYMMDD.tar.gz
docker compose -f docker-compose.ssl.yml restart nginx
```

## Migration from HTTP to HTTPS

If you're migrating from the standard setup:

1. Stop the old setup:
   ```bash
   docker compose -f docker-compose.yml down
   ```

2. Run the SSL initialization:
   ```bash
   ./init-letsencrypt.sh your-domain.com your-email@example.com
   ```

3. Update any bookmarks or links to use HTTPS and port 8443

## Support

For issues specific to:
- **Let's Encrypt**: https://community.letsencrypt.org/
- **Certbot**: https://certbot.eff.org/docs/
- **Nginx**: https://nginx.org/en/docs/
- **Random Music Server**: Check the main README.md

## Quick Reference

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Nginx | 8080 | HTTP | Redirects to HTTPS, ACME challenges |
| Nginx | 8443 | HTTPS | SSL-encrypted traffic |
| Random Music | 8000 | HTTP | Internal only (not exposed) |

**Certificate Locations:**
- Certificates: `./certbot/conf/live/your-domain.com/`
- Renewal config: `./certbot/conf/renewal/your-domain.com.conf`
- ACME challenges: `./certbot/www/.well-known/acme-challenge/`

**Important Commands:**
```bash
# Initial setup
./init-letsencrypt.sh your-domain.com your-email@example.com

# Start services
docker compose -f docker-compose.ssl.yml up -d

# View logs
docker compose -f docker-compose.ssl.yml logs -f

# Manual renewal
./renew-certificates.sh

# Test Nginx config
docker compose -f docker-compose.ssl.yml exec nginx nginx -t

# Reload Nginx
docker compose -f docker-compose.ssl.yml exec nginx nginx -s reload
```
