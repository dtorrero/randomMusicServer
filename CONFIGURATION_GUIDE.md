# Configuration Guide for Standard Ports SSL Setup

## Your Questions Answered:

### 1. **Can I use my current docker-compose.yml?**
**Yes, with modifications.** You have two options:

**Option A: Use the new docker-compose.ssl-standard-ports.yml**
- Copy your music directory path from your current docker-compose.yml
- Update the volume mount in docker-compose.ssl-standard-ports.yml

**Option B: Modify your existing docker-compose.yml**
Add these services to your current file:
```yaml
# Add to your existing docker-compose.yml:
services:
  nginx:
    container_name: nginx-ssl-proxy
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d-standard-ports:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - random-music
    restart: unless-stopped
    cap_add:
      - NET_BIND_SERVICE
    command: "/bin/sh -c 'while :; do sleep 6h & wait $${!}; nginx -s reload; done & nginx -g \"daemon off;\"'"

  certbot:
    container_name: certbot
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    restart: unless-stopped
```

### 2. **Where do scripts run?**
**On the host system, NOT in containers.** The scripts:
- `init-letsencrypt-standard-ports-podman.sh`
- `renew-certificates-standard-ports-podman.sh`

These are **bash scripts that run on your Linux host** and execute `podman-compose` commands. They manage the containers but run outside of them.

### 3. **Do I need to install scripts in root system?**
**No installation needed.** Just:
1. Download the scripts to your project directory
2. Make them executable: `chmod +x script-name.sh`
3. Run them from your project directory

## Step-by-Step Configuration:

### Step 1: Update Music Directory Path
Edit `docker-compose.ssl-standard-ports.yml` and change:
```yaml
volumes:
  - /path/to/your/music:/music:ro  # ← Change this to your actual music path
  - ./data:/data
```

### Step 2: Prepare Scripts
```bash
# Download scripts (they're already in your project)
# Make them executable
chmod +x init-letsencrypt-standard-ports-podman.sh
chmod +x renew-certificates-standard-ports-podman.sh
```

### Step 3: Configure Firewall
```bash
# Allow ports 80/443
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### Step 4: Get SSL Certificates
```bash
# Test with staging server (no rate limits)
./init-letsencrypt-standard-ports-podman.sh your-domain.com your-email@example.com 1

# Production (after testing)
./init-letsencrypt-standard-ports-podman.sh your-domain.com your-email@example.com
```

### Step 5: Start Services
```bash
podman-compose -f docker-compose.ssl-standard-ports.yml up -d
```

## File Locations:

- **Scripts**: In your project directory (`/home/sprinter/Proyectos/randomMusicServer/`)
- **Configs**: `nginx/conf.d-standard-ports/`
- **Certificates**: `certbot/` (auto-created)
- **Docker Compose**: `docker-compose.ssl-standard-ports.yml`

## Using Your Current Setup:

If you prefer to keep your current `docker-compose.yml`:
1. Copy the nginx and certbot services from `docker-compose.ssl-standard-ports.yml`
2. Paste them into your `docker-compose.yml`
3. Update the music directory path in your existing file
4. Use `podman-compose -f docker-compose.yml up -d`

## Summary:

1. **Scripts run on host**: Not in containers
2. **No root installation**: Scripts stay in project directory
3. **Use existing docker-compose**: Possible with modifications
4. **Standard ports**: 80 (HTTP) and 443 (HTTPS)

The setup is flexible - use the new file or modify your existing one.
