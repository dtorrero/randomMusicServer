# Deployment Plan for SSL Setup

## Your Current Plan (with corrections):

### ✅ **Correct Steps:**
1. **Commit changes** to GitHub
2. **Wait for GitHub Actions** to build container
3. **On your server**: Stop container: `podman-compose down`
4. **Pull changes**: `podman-compose pull`
5. **Start container**: `podman-compose up -d`

### ❌ **What You're Missing/Wrong:**

**Wrong**: `podman exec container-id` to run certbot steps inside container  
**Correct**: **Run scripts on the host** before starting containers

## Complete Correct Deployment Plan:

### Phase 1: Development (Your Machine)
1. Commit SSL configuration files to GitHub
2. GitHub Actions builds new container image

### Phase 2: Server Deployment
```bash
# 1. SSH to your server
ssh user@your-server

# 2. Navigate to project directory
cd /path/to/randomMusicServer

# 3. Pull latest code (including new SSL configs)
git pull origin main

# 4. Stop existing services
podman-compose down

# 5. Make SSL scripts executable
chmod +x init-letsencrypt-standard-ports-podman.sh
chmod +x renew-certificates-standard-ports-podman.sh

# 6. Update docker-compose.ssl-standard-ports.yml with your music path
# Edit the file: change /path/to/your/music to your actual path

# 7. Get SSL certificates (ON THE HOST, not in container)
./init-letsencrypt-standard-ports-podman.sh your-domain.com your-email@example.com 1

# 8. Start SSL-enabled services
podman-compose -f docker-compose.ssl-standard-ports.yml up -d
```

## Key Differences from Your Previous Approach:

### Old Way (Wrong for SSL):
```bash
podman-compose up -d
podman exec container-id some-certbot-command  # ❌ Inside container
```

### New Way (Correct for SSL):
```bash
# 1. Run certbot setup on HOST
./init-letsencrypt-standard-ports-podman.sh domain.com email@example.com

# 2. Start containers with SSL config
podman-compose -f docker-compose.ssl-standard-ports.yml up -d
```

## Why This Difference?

1. **Certbot needs access to port 80** on your host for HTTP challenge
2. **Certificates are stored on host** in `./certbot/` directory
3. **Nginx mounts host certificates** as volume: `./certbot/conf:/etc/letsencrypt:ro`
4. **Scripts coordinate multiple containers** (nginx + certbot + your app)

## What the Script Does:

The `init-letsencrypt-standard-ports-podman.sh` script:
1. Creates directories on host
2. Starts nginx temporarily with HTTP-only config
3. Runs certbot container to get certificates
4. Updates nginx config with SSL settings
5. Restarts nginx with SSL enabled

## Post-Deployment Verification:

```bash
# Check if services are running
podman-compose -f docker-compose.ssl-standard-ports.yml ps

# Test HTTPS
curl -I https://your-domain.com

# View logs
podman-compose -f docker-compose.ssl-standard-ports.yml logs -f
```

## If You Want to Keep Using Your Existing docker-compose.yml:

Modify it to include nginx and certbot services (copy from docker-compose.ssl-standard-ports.yml), then:
```bash
# After modifying your docker-compose.yml
./init-letsencrypt-standard-ports-podman.sh domain.com email@example.com
podman-compose up -d  # Uses your modified docker-compose.yml
```

## Summary:

**Don't run certbot inside containers** - use the host scripts. The sequence is:
1. Git pull (get new configs)
2. Run SSL setup script (on host)
3. Start containers with SSL config

This ensures certificates are properly obtained and mounted into containers.
