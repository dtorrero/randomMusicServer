# Podman Setup Guide for Standard Ports (80/443)

This guide addresses your specific questions about using Podman with the standard ports SSL setup.

## Your Questions Answered:

### 1. **Music Directory Path**
✅ **Already Updated**: I've updated `docker-compose.ssl-standard-ports.yml` with your music path:
```yaml
volumes:
  - /home/rpibro/Musica:/music:ro
  - ./data:/data
```

### 2. **GitHub Actions**
✅ **Doesn't Matter**: GitHub Actions is for CI/CD and doesn't affect your local/remote server setup. The configuration works independently.

### 3. **Where to Run the Script**
✅ **Run on the Host**: The `init-letsencrypt-standard-ports-podman.sh` script should be run **on your host machine** (where Podman is installed), **NOT inside a container**.

### 4. **Podman Commands**
✅ **Podman-Compatible Scripts Created**: I've created Podman-specific scripts:
- `init-letsencrypt-standard-ports-podman.sh` - Initial certificate setup
- `renew-certificates-standard-ports-podman.sh` - Manual renewal

## Quick Setup Commands (Podman):

### Step 1: Make Scripts Executable (if not already)
```bash
chmod +x init-letsencrypt-standard-ports-podman.sh
chmod +x renew-certificates-standard-ports-podman.sh
```

### Step 2: Stop Existing Services
```bash
# Stop your current setup (if running)
podman-compose -f docker-compose.yml down
```

### Step 3: Configure Firewall
```bash
# Allow ports 80 and 443
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### Step 4: Get SSL Certificates
```bash
# For testing (staging server - no rate limits)
./init-letsencrypt-standard-ports-podman.sh your-domain.com your-email@example.com 1

# For production
./init-letsencrypt-standard-ports-podman.sh your-domain.com your-email@example.com
```

### Step 5: Start All Services
```bash
podman-compose -f docker-compose.ssl-standard-ports.yml up -d
```

## Daily Operations (Podman):

### Start Services
```bash
podman-compose -f docker-compose.ssl-standard-ports.yml up -d
```

### Stop Services
```bash
podman-compose -f docker-compose.ssl-standard-ports.yml down
```

### View Logs
```bash
# All services
podman-compose -f docker-compose.ssl-standard-ports.yml logs -f

# Specific service
podman-compose -f docker-compose.ssl-standard-ports.yml logs -f nginx
```

### Restart Nginx
```bash
podman-compose -f docker-compose.ssl-standard-ports.yml restart nginx
```

## Important Notes for Podman:

1. **`podman-compose` vs `docker-compose`**: 
   - Use `podman-compose` instead of `docker-compose`
   - If you don't have `podman-compose`, install it or use `podman compose` (with space)

2. **Image Name Resolution**:
   - Docker Compose files use fully qualified image names (`docker.io/nginx:alpine`, `docker.io/certbot/certbot`)
   - If you encounter "short-name" errors, configure Podman or pull images manually:
     ```bash
     podman pull docker.io/nginx:alpine
     podman pull docker.io/certbot/certbot
     ```

3. **Root vs Rootless**:
   - If running Podman rootless, ports below 1024 may require additional setup
   - The nginx container has `NET_BIND_SERVICE` capability for port 80/443

4. **Port Conflicts**:
   - Ensure ports 80 and 443 are free on your host
   ```bash
   sudo ss -tulpn | grep ':80\|:443'
   ```

## Troubleshooting Podman Issues:

### If `podman-compose` is not available:
```bash
# Install podman-compose
sudo dnf install podman-compose  # RHEL/Fedora
sudo apt install podman-compose  # Debian/Ubuntu

# Or use podman with compose plugin
podman compose -f docker-compose.ssl-standard-ports.yml up -d
```

### If ports 80/443 fail to bind:
```bash
# Check if SELinux is blocking
sudo setsebool -P container_manage_cgroup true

# Check podman permissions
podman info | grep -A5 "rootless"
```

### Certificate renewal not working:
```bash
# Check certbot logs
podman-compose -f docker-compose.ssl-standard-ports.yml logs certbot

# Manual renewal test
./renew-certificates-standard-ports-podman.sh
```

## File Summary:

You now have these new files:
- `docker-compose.ssl-standard-ports.yml` - Updated with your music path
- `init-letsencrypt-standard-ports-podman.sh` - Podman certificate setup
- `renew-certificates-standard-ports-podman.sh` - Podman certificate renewal
- `PODMAN_SETUP_GUIDE.md` - This guide

## Next Steps:

1. **Update `your-domain.com`** in the commands with your actual domain
2. **Run the initialization script** (use staging first for testing)
3. **Test HTTPS access** at `https://your-domain.com`
4. **Bookmark** the HTTPS URL (no port needed!)

The setup is complete and ready for your Podman environment.
