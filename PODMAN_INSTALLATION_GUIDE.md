# Podman Installation Guide for Random Music Server with SSL

This guide provides detailed step-by-step instructions for installing the Random Music Server on your server using Podman with SSL on standard ports (80/443).

## Prerequisites

### System Requirements
- Linux server with Podman installed
- Domain name pointing to your server's IP address
- Ports 80 and 443 open in firewall
- Root or sudo access for initial setup

### Required Software
```bash
# Check Podman installation
podman --version

# Check podman-compose availability
podman-compose --version || podman compose version

# If not installed, install them:
# For RHEL/Fedora/CentOS:
sudo dnf install podman podman-compose

# For Debian/Ubuntu:
sudo apt install podman podman-compose
```

## Installation Steps

### Step 1: Prepare Your Server (Run as root/sudo)

#### 1.1 Update System
```bash
sudo dnf update -y  # RHEL/Fedora
# OR
sudo apt update && sudo apt upgrade -y  # Debian/Ubuntu
```

#### 1.2 Configure Firewall
```bash
# Allow HTTP and HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# Alternative for ufw:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

#### 1.3 Check Port Availability
```bash
# Ensure ports 80 and 443 are not in use
sudo ss -tulpn | grep ':80\|:443'
```

### Step 2: Clone or Copy Project Files

#### 2.1 Clone Repository (if using git)
```bash
git clone https://github.com/dtorrero/randomMusicServer.git
cd randomMusicServer
```

#### 2.2 Or Copy Necessary Files
If you already have the files, ensure you have:
- `docker-compose.ssl-standard-ports.yml` (updated with your music path)
- `init-letsencrypt-standard-ports-podman.sh`
- `renew-certificates-standard-ports-podman.sh`
- `nginx/conf.d-standard-ports/` directory
- `nginx/nginx.conf`

### Step 3: Configure Music Directory

#### 3.1 Update Compose File (if not already done)
Edit `docker-compose.ssl-standard-ports.yml` and update the music volume:
```yaml
volumes:
  - /home/rpibro/Musica:/music:ro  # Your music directory
  - ./data:/data
```

### Step 4: SSL Certificate Setup

#### 4.1 Make Scripts Executable (Run on host)
```bash
chmod +x init-letsencrypt-standard-ports-podman.sh
chmod +x renew-certificates-standard-ports-podman.sh
```

#### 4.2 Initialize SSL Certificates (Run on host)
**For testing (staging server - no rate limits):**
```bash
./init-letsencrypt-standard-ports-podman.sh YOUR-DOMAIN.com your-email@example.com 1
```

**For production:**
```bash
./init-letsencrypt-standard-ports-podman.sh YOUR-DOMAIN.com your-email@example.com
```

### Step 5: Start All Services

#### 5.1 Start the Stack (Run on host)
```bash
podman-compose -f docker-compose.ssl-standard-ports.yml up -d
```

#### 5.2 Verify Services are Running
```bash
podman-compose -f docker-compose.ssl-standard-ports.yml ps
```

## Command Reference: Root vs Container

### Commands to Run on Host (Root/User)

| Command | Purpose | Run as |
|---------|---------|---------|
| `podman-compose -f FILE up -d` | Start services | User |
| `podman-compose -f FILE down` | Stop services | User |
| `podman-compose -f FILE logs` | View logs | User |
| `./init-letsencrypt-*.sh` | SSL setup | User |
| `firewall-cmd` | Firewall config | Root |
| `chmod +x script.sh` | Make executable | User |

### Commands to Run Inside Containers

| Command | Container | Purpose |
|---------|-----------|---------|
| `nginx -t` | nginx | Test nginx config |
| `nginx -s reload` | nginx | Reload nginx |
| `certbot renew` | certbot | Renew certificates |
| `curl http://localhost:8000/health` | random-music | Health check |

### How to Execute Container Commands from Host:
```bash
# Execute command in running container
podman-compose -f docker-compose.ssl-standard-ports.yml exec nginx nginx -t

# Run one-time command in container
podman-compose -f docker-compose.ssl-standard-ports.yml run --rm certbot certbot renew
```

## Daily Operations

### Starting Services
```bash
# Start all services
podman-compose -f docker-compose.ssl-standard-ports.yml up -d

# Start specific service
podman-compose -f docker-compose.ssl-standard-ports.yml up -d nginx
```

### Stopping Services
```bash
# Stop all services
podman-compose -f docker-compose.ssl-standard-ports.yml down

# Stop specific service
podman-compose -f docker-compose.ssl-standard-ports.yml stop nginx
```

### Monitoring
```bash
# View logs (all services)
podman-compose -f docker-compose.ssl-standard-ports.yml logs -f

# View logs (specific service)
podman-compose -f docker-compose.ssl-standard-ports.yml logs -f nginx

# Check service status
podman-compose -f docker-compose.ssl-standard-ports.yml ps

# Check resource usage
podman stats
```

### Maintenance
```bash
# Update container images
podman-compose -f docker-compose.ssl-standard-ports.yml pull

# Restart services with new images
podman-compose -f docker-compose.ssl-standard-ports.yml down
podman-compose -f docker-compose.ssl-standard-ports.yml up -d

# Manual certificate renewal test
./renew-certificates-standard-ports-podman.sh
```

## Troubleshooting

### Port Binding Issues
```bash
# Check if ports are in use
sudo lsof -i :80
sudo lsof -i :443

# Check Podman network
podman network ls
```

### Certificate Issues
```bash
# Check certificate files
ls -la certbot/conf/live/YOUR-DOMAIN.com/

# Check certbot logs
podman-compose -f docker-compose.ssl-standard-ports.yml logs certbot

# Test certificate manually
podman-compose -f docker-compose.ssl-standard-ports.yml run --rm certbot certbot certificates
```

### Nginx Issues
```bash
# Test nginx configuration
podman-compose -f docker-compose.ssl-standard-ports.yml exec nginx nginx -t

# Check nginx error logs
podman-compose -f docker-compose.ssl-standard-ports.yml exec nginx tail -f /var/log/nginx/error.log
```

### SELinux Issues (RHEL/Fedora)
```bash
# Check SELinux status
getenforce

# If enforcing, allow container network access
sudo setsebool -P container_manage_cgroup true
```

## Security Considerations

### 1. File Permissions
```bash
# Ensure proper permissions on certificate directory
chmod 700 certbot/conf
chmod 600 certbot/conf/*.pem
```

### 2. Regular Updates
```bash
# Update container images regularly
podman-compose -f docker-compose.ssl-standard-ports.yml pull

# Update system packages
sudo dnf update -y  # or apt update && apt upgrade
```

### 3. Backup Certificates
```bash
# Backup SSL certificates
tar -czf ssl-backup-$(date +%Y%m%d).tar.gz certbot/conf/

# Backup application data
tar -czf data-backup-$(date +%Y%m%d).tar.gz data/
```

## Automation

### Systemd Service (Optional)
Create `/etc/systemd/system/random-music.service`:
```ini
[Unit]
Description=Random Music Server with SSL
Requires=network.target
After=network.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/path/to/randomMusicServer
ExecStart=/usr/bin/podman-compose -f docker-compose.ssl-standard-ports.yml up -d
ExecStop=/usr/bin/podman-compose -f docker-compose.ssl-standard-ports.yml down
User=yourusername
Group=yourgroup

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable random-music
sudo systemctl start random-music
```

## Verification Checklist

- [ ] Domain resolves to server IP: `dig +short YOUR-DOMAIN.com`
- [ ] Port 80 accessible: `curl -I http://YOUR-DOMAIN.com`
- [ ] HTTPS working: `curl -I https://YOUR-DOMAIN.com`
- [ ] Certificate valid: `openssl s_client -connect YOUR-DOMAIN.com:443 -servername YOUR-DOMAIN.com | openssl x509 -noout -dates`
- [ ] Music playing: Access `https://YOUR-DOMAIN.com` in browser
- [ ] Health check: `curl -f https://YOUR-DOMAIN.com/health`

## Support

If you encounter issues:
1. Check logs: `podman-compose -f docker-compose.ssl-standard-ports.yml logs`
2. Verify firewall: `sudo firewall-cmd --list-all`
3. Check DNS: `nslookup YOUR-DOMAIN.com`
4. Review this guide and `PODMAN_SETUP_GUIDE.md`

Your Random Music Server should now be running securely at `https://YOUR-DOMAIN.com` with automatic SSL certificate management.
