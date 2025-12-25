# Clean Installation Guide for Podman SSL Setup

Based on the errors you encountered, here are the steps to clean up and successfully install with SSL using Podman.

## Issue 1: Existing Containers Conflict

The script is trying to create containers that already exist. Clean them up first:

```bash
# Stop and remove all containers from previous attempts
podman stop random-music-server nginx-ssl-proxy certbot 2>/dev/null || true
podman rm random-music-server nginx-ssl-proxy certbot 2>/dev/null || true

# Remove the network (if it exists)
podman network rm randommusicserver_music-network 2>/dev/null || true

# Clean up any dangling containers
podman container prune -f
```

## Issue 2: Rootless Podman Cannot Bind to Ports 80/443

Podman running rootless cannot bind to ports below 1024 by default. You have three options:

### Option A: Configure System for Rootless Ports (Recommended)
```bash
# Allow rootless Podman to use ports 80 and 443
sudo sysctl net.ipv4.ip_unprivileged_port_start=80

# Make it permanent
echo "net.ipv4.ip_unprivileged_port_start=80" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Option B: Run Podman as Root for Nginx Only
Modify the script or run nginx with sudo. This is more complex.

### Option C: Use Port Forwarding (Alternative)
If you can't modify sysctl, use iptables to forward ports:
```bash
# Forward port 80 to 8080 and 443 to 8443
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080
sudo iptables -t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 8443

# Then modify docker-compose.ssl-standard-ports.yml to use ports 8080 and 8443
```

## Complete Clean Installation Steps

### Step 1: Clean Up Everything
```bash
cd ~/randomMusicServer

# Stop and remove all containers
podman-compose -f docker-compose.ssl-standard-ports.yml down 2>/dev/null || true

# Manual cleanup if needed
podman stop $(podman ps -aq) 2>/dev/null || true
podman rm $(podman ps -aq) 2>/dev/null || true

# Remove networks
podman network prune -f

# Remove certificate data (optional - removes previous SSL attempts)
rm -rf certbot/conf/* certbot/www/*
```

### Step 2: Configure System for Rootless Podman
```bash
# Allow rootless Podman to use ports 80/443
sudo sysctl net.ipv4.ip_unprivileged_port_start=80
echo "net.ipv4.ip_unprivileged_port_start=80" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Verify the change
sysctl net.ipv4.ip_unprivileged_port_start
```

### Step 3: Update Firewall
```bash
# Ensure firewall allows ports 80 and 443
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### Step 4: Run SSL Setup Script
```bash
# Make sure scripts are executable
chmod +x init-letsencrypt-standard-ports-podman.sh
chmod +x renew-certificates-standard-ports-podman.sh

# Run with staging server first
./init-letsencrypt-standard-ports-podman.sh randomplayer.duckdns.org david.torrero@gmail.com 1
```

## Troubleshooting Nginx Not Starting

If nginx still won't start after the above steps:

### Check if Ports are Already in Use
```bash
sudo ss -tulpn | grep ':80\|:443'
```

### Test Nginx Manually
```bash
# Try starting nginx manually to see the error
podman run --rm -p 80:80 docker.io/nginx:alpine nginx -g "daemon off;"
```

### Verify Podman Can Bind to Port 80
```bash
# Test with a simple container
podman run --rm -p 80:8080 docker.io/nginx:alpine nginx -g "daemon off;" &
sleep 2
curl http://localhost:8080
pkill -f "podman run"
```

## Alternative: Use Docker Instead of Podman

If Podman continues to have issues, consider using Docker instead:

```bash
# Install Docker
sudo apt install docker.io docker-compose

# Run the Docker version of the script
./init-letsencrypt-standard-ports.sh randomplayer.duckdns.org david.torrero@gmail.com 1
```

## Verification After Successful Installation

Once the SSL setup completes:

```bash
# Check running containers
podman-compose -f docker-compose.ssl-standard-ports.yml ps

# Test HTTPS
curl -I https://randomplayer.duckdns.org

# Check certificates
ls -la certbot/conf/live/randomplayer.duckdns.org/
```

## Important Notes

1. **Domain Configuration**: Ensure `randomplayer.duckdns.org` points to your server's public IP address
2. **Port Forwarding**: If behind a router/NAT, forward ports 80 and 443 to your server
3. **Firewall**: Both host firewall and any cloud provider firewall must allow ports 80/443
4. **DuckDNS**: Make sure your DuckDNS domain is updated with your current IP

If you continue to have issues, check:
- `podman logs nginx-ssl-proxy` for nginx errors
- `podman logs certbot` for certificate errors
- System logs: `journalctl -u podman` or `journalctl -f`

The most likely issue is the rootless Podman port binding. Option A (sysctl change) is the simplest solution.
