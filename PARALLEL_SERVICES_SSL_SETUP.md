# Parallel Services SSL Setup Guide

## Overview

This guide explains how to configure SSL/TLS for the Random Music Server to run in parallel with an existing service, both running as Podman containers on the same machine.

### Current Environment
- **Service 1 (Existing)**: `newreleases.duckdns.org` on ports 80/443
- **Service 2 (To Configure)**: `randomplayer.duckdns.org` on port 8080:8000 (needs SSL)
- **Both Services**: Podman containers on same machine
- **Shared External IP**: Both domains point to same external IP
- **Internal IPs**: Service 1 (.42), Service 2 (.43)

## Prerequisites

1. **DNS Configuration**: Both domains must point to your server's external IP
2. **Port Availability**: Ports 8080 and 8443 must be available
3. **Podman**: Installed and running
4. **Firewall**: Ports 8080 and 8443 must be open
5. **Router**: Port forwarding configured for 8080 and 8443

## Step 1: Verify Current Setup

### Check Running Containers
```bash
# List all Podman containers
podman ps

# Check port usage
sudo ss -tulpn | grep -E ":(80|443|8000|8080|8443)"
```

### Verify DNS Resolution
```bash
# Both domains should return the same IP
dig +short newreleases.duckdns.org
dig +short randomplayer.duckdns.org
```

## Step 2: Configure Random Music Server for SSL

### 2.1 Update Nginx Configuration

Edit the SSL configuration file:
```bash
nano nginx/conf.d/default.conf
```

Update the `server_name` directive:
```nginx
# Change from:
server_name _;

# To:
server_name randomplayer.duckdns.org;
```

### 2.2 Verify Port Configuration

Check `docker-compose.ssl.yml` has correct port mappings:
```yaml
services:
  nginx:
    ports:
      - "8080:8080"    # HTTP for ACME challenges
      - "8443:8443"    # HTTPS for SSL
```

## Step 3: Initialize SSL Certificates

### 3.1 Make Scripts Executable
```bash
chmod +x init-letsencrypt-podman.sh renew-certificates-podman.sh
```

### 3.2 Run SSL Initialization
```bash
# Replace email with your actual email address
./init-letsencrypt-podman.sh randomplayer.duckdns.org your-email@example.com
```

**What the script does:**
1. Creates necessary directories
2. Generates temporary dummy certificate
3. Starts nginx with HTTP-only configuration
4. Requests real certificates from Let's Encrypt
5. Switches to HTTPS configuration
6. Reloads nginx with SSL certificates

### 3.3 Test with Staging Server (Optional)
For testing without hitting Let's Encrypt rate limits:
```bash
./init-letsencrypt-podman.sh randomplayer.duckdns.org your-email@example.com 1
```

## Step 4: Configure Network Access

### 4.1 Local Firewall Configuration

**For firewalld:**
```bash
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --add-port=8443/tcp
sudo firewall-cmd --reload
```

**For iptables:**
```bash
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 8443 -j ACCEPT
```

### 4.2 Router Port Forwarding

Configure your router to forward:
- Port 8080 → Your machine's internal IP
- Port 8443 → Your machine's internal IP

## Step 5: Deploy SSL-Enabled Service

### 5.1 Stop Existing Non-SSL Service
```bash
podman-compose -f docker-compose.yml down
```

### 5.2 Start SSL-Enabled Service
```bash
podman-compose -f docker-compose.ssl.yml up -d
```

### 5.3 Verify Deployment
```bash
# Check container status
podman-compose -f docker-compose.ssl.yml ps

# View logs
podman-compose -f docker-compose.ssl.yml logs -f
```

## Step 6: Test Configuration

### 6.1 Test HTTP Redirect
```bash
# Should return 301 redirect to HTTPS
curl -I http://randomplayer.duckdns.org:8080
```

### 6.2 Test HTTPS Access
```bash
# Should return 200 OK
curl -I https://randomplayer.duckdns.org:8443

# Test application health endpoint
curl https://randomplayer.duckdns.org:8443/health
```

### 6.3 Test Both Services in Parallel
```bash
# Service 1 (existing)
curl -I https://newreleases.duckdns.org

# Service 2 (new SSL)
curl -I https://randomplayer.duckdns.org:8443
```

## Step 7: Final Verification

### 7.1 SSL Certificate Verification
```bash
# Check certificate details
openssl s_client -connect randomplayer.duckdns.org:8443 -servername randomplayer.duckdns.org | openssl x509 -noout -subject -dates

# Verify certificate files exist
ls -la certbot/conf/live/randomplayer.duckdns.org/
```

### 7.2 Service Accessibility
```bash
# From external network (if possible)
curl -v https://randomplayer.duckdns.org:8443
```

## Network Architecture

```
External Internet
       |
       v
[Your Router]
       | (Port Forwarding)
       | 80,443 → Machine IP (Service 1)
       | 8080,8443 → Machine IP (Service 2)
       v
[Your Machine]
       |
       +--- Service 1: newreleases.duckdns.org
       |     Ports: 80:80, 443:443
       |     Container IP: .42
       |
       +--- Service 2: randomplayer.duckdns.org
             Ports: 8080:8080, 8443:8443
             Container IP: .43
```

## Configuration Files Reference

### Nginx Configuration (`nginx/conf.d/default.conf`)
```nginx
# HTTP server on port 8080
server {
    listen 8080;
    server_name randomplayer.duckdns.org;

    # ACME challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect to HTTPS
    location / {
        return 301 https://$host:8443$request_uri;
    }
}

# HTTPS server on port 8443
server {
    listen 8443 ssl http2;
    server_name randomplayer.duckdns.org;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/randomplayer.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/randomplayer.duckdns.org/privkey.pem;

    # ... rest of SSL configuration
    # Proxy to random-music service
    location / {
        proxy_pass http://random-music:8000;
    }
}
```

### Docker Compose SSL (`docker-compose.ssl.yml`)
Key sections:
```yaml
services:
  random-music:
    ports:
      - "8000:8000"  # Internal only
    
  nginx:
    ports:
      - "8080:8080"  # HTTP for ACME/redirect
      - "8443:8443"  # HTTPS for SSL
    
  certbot:
    # Auto-renewal every 12 hours
```

## Troubleshooting Guide

### Issue 1: Port Already in Use
```bash
# Find process using port
sudo lsof -i :8080
sudo lsof -i :8443

# Alternative: Use different ports
# Update docker-compose.ssl.yml and nginx config
```

### Issue 2: Let's Encrypt ACME Challenge Fails
```bash
# Check nginx logs
podman-compose -f docker-compose.ssl.yml logs nginx

# Check certbot logs
podman-compose -f docker-compose.ssl.yml logs certbot

# Test port accessibility from internet
# From another machine:
curl http://randomplayer.duckdns.org:8080/.well-known/acme-challenge/test
```

### Issue 3: SSL Certificate Not Found
```bash
# Check certificate files
ls -la certbot/conf/live/randomplayer.duckdns.org/

# Verify nginx config points to correct path
grep ssl_certificate nginx/conf.d/default.conf

# Restart nginx
podman-compose -f docker-compose.ssl.yml restart nginx
```

### Issue 4: Containers Can't Communicate
```bash
# Check network
podman network ls

# Create shared network if needed
podman network create music-network

# Update docker-compose.ssl.yml to use this network
```

### Issue 5: SELinux Blocking Access
```bash
# Check SELinux status
getenforce

# If enforcing, add ports
sudo semanage port -a -t http_port_t -p tcp 8080
sudo semanage port -a -t http_port_t -p tcp 8443
```

## Maintenance Commands

### View Logs
```bash
# All services
podman-compose -f docker-compose.ssl.yml logs -f

# Specific service
podman-compose -f docker-compose.ssl.yml logs -f nginx
podman-compose -f docker-compose.ssl.yml logs -f certbot
podman-compose -f docker-compose.ssl.yml logs -f random-music
```

### Manual Certificate Renewal
```bash
./renew-certificates-podman.sh
```

### Restart Services
```bash
# Restart all
podman-compose -f docker-compose.ssl.yml restart

# Restart specific service
podman-compose -f docker-compose.ssl.yml restart nginx
```

### Update Configuration
```bash
# Test nginx configuration
podman-compose -f docker-compose.ssl.yml exec nginx nginx -t

# Reload nginx
podman-compose -f docker-compose.ssl.yml exec nginx nginx -s reload
```

## Monitoring and Verification

### Daily Check Script
Create `check-services.sh`:
```bash
#!/bin/bash
echo "Checking Service 1 (newreleases.duckdns.org)..."
curl -s -o /dev/null -w "%{http_code}" https://newreleases.duckdns.org
echo ""

echo "Checking Service 2 (randomplayer.duckdns.org)..."
curl -s -o /dev/null -w "%{http_code}" https://randomplayer.duckdns.org:8443
echo ""

echo "Checking certificate expiration..."
openssl s_client -connect randomplayer.duckdns.org:8443 -servername randomplayer.duckdns.org 2>/dev/null | openssl x509 -noout -dates
```

### Certificate Expiration Monitoring
Certificates auto-renew every 60 days. Check renewal status:
```bash
# Check renewal logs
podman-compose -f docker-compose.ssl.yml logs certbot | grep -i renew
```

## Backup and Recovery

### Backup Certificates
```bash
# Create backup
tar -czf certbot-backup-$(date +%Y%m%d).tar.gz certbot/conf/

# Restore from backup
tar -xzf certbot-backup-YYYYMMDD.tar.gz
podman-compose -f docker-compose.ssl.yml restart nginx
```

### Backup Configuration
```bash
# Important files to backup
cp -r nginx/conf.d/ nginx-backup/
cp docker-compose.ssl.yml docker-compose.ssl.yml.backup
cp .env .env.backup
```

## Final Access URLs

| Service | Protocol | URL | Port |
|---------|----------|-----|------|
| Service 1 | HTTPS | `https://newreleases.duckdns.org` | 443 |
| Service 2 | HTTP | `http://randomplayer.duckdns.org:8080` | 8080 |
| Service 2 | HTTPS | `https://randomplayer.duckdns.org:8443` | 8443 |

## Quick Reference Commands

```bash
# Start SSL service
podman-compose -f docker-compose.ssl.yml up -d

# Stop SSL service
podman-compose -f docker-compose.ssl.yml down

# View status
podman-compose -f docker-compose.ssl.yml ps

# Initialize SSL
./init-letsencrypt-podman.sh randomplayer.duckdns.org your-email@example.com

# Manual renewal
./renew-certificates-podman.sh

# Test configuration
curl -I https://randomplayer.duckdns.org:8443
```

## Support and Troubleshooting

If issues persist:
1. Check all logs: `podman-compose -f docker-compose.ssl.yml logs`
2. Verify DNS: `dig +short randomplayer.duckdns.org`
3. Test port accessibility from external network
4. Check firewall and router configurations
5. Review Let's Encrypt rate limits (use staging for testing)

## Appendix: Podman vs Docker Commands

| Task | Docker Command | Podman Command |
|------|---------------|----------------|
| Start services | `docker-compose up -d` | `podman-compose up -d` |
| View logs | `docker-compose logs` | `podman-compose logs` |
| Stop services | `docker-compose down` | `podman-compose down` |
| Check status | `docker-compose ps` | `podman-compose ps` |
| Exec into container | `docker-compose exec` | `podman-compose exec` |

---

**Last Updated**: $(date)
**Document Version**: 1.0
**Applicable to**: Random Music Server with parallel service configuration
