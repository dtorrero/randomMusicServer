# Installation Guide: Random Music Server with SSL using Podman-Compose

This guide provides step-by-step instructions to install and run the Random Music Server with SSL/TLS encryption using Podman and podman-compose.

## Prerequisites

Before you begin, ensure you have:

1. **A Linux server** with Podman installed
2. **A domain name** pointing to your server's IP address
3. **Ports 80 and 443** open in your firewall
4. **Root or sudo access** for initial setup
5. **Your music directory** path ready

## Quick Installation (5 Steps)

### Step 1: Install Podman and podman-compose

```bash
# For RHEL/Fedora/CentOS:
sudo dnf install podman podman-compose

# For Debian/Ubuntu:
sudo apt update
sudo apt install podman podman-compose
```

**Important for Rootless Podman**: If running Podman rootless (default), configure it to use ports 80/443:
```bash
# Allow rootless Podman to bind to ports below 1024
sudo sysctl net.ipv4.ip_unprivileged_port_start=80
echo "net.ipv4.ip_unprivileged_port_start=80" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Step 2: Clone or Download the Project

```bash
# Clone the repository
git clone https://github.com/dtorrero/randomMusicServer.git
cd randomMusicServer

# OR if you already have the files, navigate to the project directory
```

### Step 3: Configure Firewall

```bash
# Allow HTTP and HTTPS traffic
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# Alternative for ufw users:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### Step 4: Update Configuration Files

1. **Edit the docker-compose file** to set your music directory:
   ```bash
   nano docker-compose.ssl-standard-ports.yml
   ```
   
   Update the volume mount (around line 18):
   ```yaml
   volumes:
     - /path/to/your/music:/music:ro  # Change to your actual music path
     - ./data:/data
   ```

2. **Make SSL scripts executable**:
   ```bash
   chmod +x init-letsencrypt-standard-ports-podman.sh
   chmod +x renew-certificates-standard-ports-podman.sh
   ```

### Step 5: Set Up SSL Certificates and Start Services

1. **Initialize SSL certificates** (use staging first for testing):
   ```bash
   # For testing (no rate limits):
   ./init-letsencrypt-standard-ports-podman.sh your-domain.com your-email@example.com 1
   
   # For production:
   ./init-letsencrypt-standard-ports-podman.sh your-domain.com your-email@example.com
   ```

2. **Start all services**:
   ```bash
   podman-compose -f docker-compose.ssl-standard-ports.yml up -d
   ```

3. **Verify the installation**:
   ```bash
   # Check running services
   podman-compose -f docker-compose.ssl-standard-ports.yml ps
   
   # Test HTTPS access
   curl -I https://your-domain.com
   ```

## Complete Step-by-Step Guide

### 1. System Preparation

#### 1.1 Update System Packages
```bash
# RHEL/Fedora
sudo dnf update -y

# Debian/Ubuntu
sudo apt update && sudo apt upgrade -y
```

#### 1.2 Verify Podman Installation
```bash
podman --version
podman-compose --version

# If podman-compose is not found, try:
podman compose version
```

#### 1.3 Check Port Availability
Ensure ports 80 and 443 are not already in use:
```bash
sudo ss -tulpn | grep ':80\|:443'
```

### 2. Project Setup

#### 2.1 Get the Project Files
If you haven't cloned the repository:
```bash
git clone https://github.com/dtorrero/randomMusicServer.git
cd randomMusicServer
```

#### 2.2 Verify Required Files Exist
Ensure you have these key files:
- `docker-compose.ssl-standard-ports.yml`
- `init-letsencrypt-standard-ports-podman.sh`
- `renew-certificates-standard-ports-podman.sh`
- `nginx/conf.d-standard-ports/` directory

### 3. SSL Certificate Setup

#### 3.1 Prepare SSL Scripts
```bash
# Make scripts executable
chmod +x init-letsencrypt-standard-ports-podman.sh
chmod +x renew-certificates-standard-ports-podman.sh
```

#### 3.2 Run SSL Initialization
The initialization script will:
1. Create necessary directories
2. Set up temporary certificates
3. Request real certificates from Let's Encrypt
4. Configure Nginx for HTTPS

```bash
# Replace with your actual domain and email
DOMAIN="your-domain.com"
EMAIL="your-email@example.com"

# For testing (recommended first):
./init-letsencrypt-standard-ports-podman.sh $DOMAIN $EMAIL 1

# For production (after testing):
./init-letsencrypt-standard-ports-podman.sh $DOMAIN $EMAIL
```

### 4. Start the Application

#### 4.1 Launch All Services
```bash
podman-compose -f docker-compose.ssl-standard-ports.yml up -d
```

#### 4.2 Verify Services are Running
```bash
# List all containers
podman-compose -f docker-compose.ssl-standard-ports.yml ps

# Check logs
podman-compose -f docker-compose.ssl-standard-ports.yml logs --tail=20
```

### 5. Post-Installation Verification

#### 5.1 Test HTTPS Access
```bash
# Test with curl
curl -I https://your-domain.com

# Test certificate validity
openssl s_client -connect your-domain.com:443 -servername your-domain.com | openssl x509 -noout -dates
```

#### 5.2 Access the Web Interface
Open your browser and navigate to:
```
https://your-domain.com
```

You should see the Random Music Server interface.

## Daily Operations

### Starting/Stopping Services
```bash
# Start all services
podman-compose -f docker-compose.ssl-standard-ports.yml up -d

# Stop all services
podman-compose -f docker-compose.ssl-standard-ports.yml down

# Restart specific service
podman-compose -f docker-compose.ssl-standard-ports.yml restart nginx
```

### Monitoring
```bash
# View logs (follow mode)
podman-compose -f docker-compose.ssl-standard-ports.yml logs -f

# View logs for specific service
podman-compose -f docker-compose.ssl-standard-ports.yml logs -f nginx

# Check container status
podman-compose -f docker-compose.ssl-standard-ports.yml ps

# Check resource usage
podman stats
```

### Certificate Management
```bash
# Manual certificate renewal test
./renew-certificates-standard-ports-podman.sh

# Check certificate expiration
podman-compose -f docker-compose.ssl-standard-ports.yml run --rm certbot certbot certificates
```

## Troubleshooting Common Issues

### Issue: Podman Short Name Resolution Error
If you see errors like:
```
Error: short-name "certbot/certbot" did not resolve to an alias and no unqualified-search registries are defined in "/etc/containers/registries.conf"
```

**Solution 1 (Recommended):** The docker-compose files have been updated to use fully qualified image names (`docker.io/nginx:alpine`, `docker.io/certbot/certbot`). Make sure you have the latest version of the files.

**Solution 2:** Configure Podman to resolve short names:
```bash
# Edit Podman configuration
sudo nano /etc/containers/registries.conf

# Add or uncomment these lines:
unqualified-search-registries = ["docker.io"]

# Restart Podman (if needed)
systemctl --user restart podman
```

**Solution 3:** Pull images manually with full names:
```bash
podman pull docker.io/nginx:alpine
podman pull docker.io/certbot/certbot
```

### Issue: Port 80/443 Already in Use
```bash
# Check what's using the ports
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting services or change ports in docker-compose.ssl-standard-ports.yml
```

### Issue: SSL Certificate Request Fails
```bash
# Check DNS resolution
dig +short your-domain.com

# Check certbot logs
podman-compose -f docker-compose.ssl-standard-ports.yml logs certbot

# Test with staging server first
./init-letsencrypt-standard-ports-podman.sh your-domain.com your-email@example.com 1
```

### Issue: Nginx Won't Start
```bash
# Test nginx configuration
podman-compose -f docker-compose.ssl-standard-ports.yml exec nginx nginx -t

# Check nginx error logs
podman-compose -f docker-compose.ssl-standard-ports.yml exec nginx tail -f /var/log/nginx/error.log
```

### Issue: Rootless Podman Cannot Bind to Ports 80/443
If you see errors like "rootlessport cannot expose privileged port 80":
```bash
# Configure system to allow rootless Podman to use ports below 1024
sudo sysctl net.ipv4.ip_unprivileged_port_start=80
echo "net.ipv4.ip_unprivileged_port_start=80" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Verify the change
sysctl net.ipv4.ip_unprivileged_port_start
```

### Issue: SELinux Blocking (RHEL/Fedora)
```bash
# Check SELinux status
getenforce

# Allow container network access
sudo setsebool -P container_manage_cgroup true
```

## Maintenance

### Updating Containers
```bash
# Pull latest images
podman-compose -f docker-compose.ssl-standard-ports.yml pull

# Restart with new images
podman-compose -f docker-compose.ssl-standard-ports.yml down
podman-compose -f docker-compose.ssl-standard-ports.yml up -d
```

### Backup SSL Certificates
```bash
# Backup certificates
tar -czf ssl-backup-$(date +%Y%m%d).tar.gz certbot/conf/

# Backup application data
tar -czf data-backup-$(date +%Y%m%d).tar.gz data/
```

### Restore from Backup
```bash
# Restore certificates
tar -xzf ssl-backup-YYYYMMDD.tar.gz

# Restart nginx
podman-compose -f docker-compose.ssl-standard-ports.yml restart nginx
```

## Security Considerations

1. **Firewall Configuration**: Ensure only necessary ports are open
2. **Regular Updates**: Keep Podman and containers updated
3. **Certificate Monitoring**: Certificates auto-renew every 12 hours
4. **File Permissions**: Protect certificate files
   ```bash
   chmod 700 certbot/conf
   chmod 600 certbot/conf/*.pem
   ```

## Verification Checklist

- [ ] Domain resolves to server IP: `dig +short your-domain.com`
- [ ] Port 80 accessible: `curl -I http://your-domain.com`
- [ ] HTTPS working: `curl -I https://your-domain.com`
- [ ] Certificate valid: Check with openssl command
- [ ] Music playing: Access `https://your-domain.com` in browser
- [ ] Health check: `curl -f https://your-domain.com/health`

## Getting Help

If you encounter issues:

1. **Check logs**: `podman-compose -f docker-compose.ssl-standard-ports.yml logs`
2. **Review this guide** for troubleshooting steps
3. **Check existing documentation**:
   - `PODMAN_INSTALLATION_GUIDE.md` - Detailed Podman setup
   - `SSL_SETUP.md` - General SSL configuration
   - `PODMAN_SETUP_GUIDE.md` - Podman-specific guidance

## Quick Reference Commands

| Command | Purpose |
|---------|---------|
| `podman-compose -f docker-compose.ssl-standard-ports.yml up -d` | Start services |
| `podman-compose -f docker-compose.ssl-standard-ports.yml down` | Stop services |
| `podman-compose -f docker-compose.ssl-standard-ports.yml logs -f` | View logs |
| `./init-letsencrypt-standard-ports-podman.sh DOMAIN EMAIL [1]` | SSL setup |
| `./renew-certificates-standard-ports-podman.sh` | Manual renewal |
| `podman-compose -f docker-compose.ssl-standard-ports.yml ps` | Check status |

Your Random Music Server is now running securely at `https://your-domain.com` with automatic SSL certificate management.
