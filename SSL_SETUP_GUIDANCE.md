# SSL Setup Guidance for Docker Users

Based on your request for guidance on configuring SSL certificates with certbot after running `docker-compose down`, `docker-compose pull`, and `docker-compose up`, here are the steps:

## Prerequisites
- Domain name pointing to your server IP
- Ports 80 and 443 open in firewall
- Docker and Docker Compose installed
- Your music directory already configured in `docker-compose-ssl-personal.yml`

## Step-by-Step SSL Setup

### 1. Stop Current Services
```bash
docker-compose down
```

### 2. Prepare for SSL Setup
Make sure you're in the directory containing your docker-compose files.

### 3. Make SSL Script Executable
```bash
chmod +x init-letsencrypt-standard-ports.sh
```

### 4. Get SSL Certificates
**For testing (no rate limits):**
```bash
./init-letsencrypt-standard-ports.sh YOUR-DOMAIN.com your-email@example.com 1
```

**For production:**
```bash
./init-letsencrypt-standard-ports.sh YOUR-DOMAIN.com your-email@example.com
```

**Note:** This script uses `docker-compose.ssl-standard-ports.yml` which is a template. If you want to use your personal file, you have two options:

### Option A: Use Standard Template (Recommended)
1. The script will set up certificates in `./certbot/` directory
2. You'll use `docker-compose.yml` (which I've updated for SSL on standard ports)

### Option B: Use Your Personal File
If you prefer to use `docker-compose-ssl-personal.yml`, modify the script or run these commands manually:

```bash
# Create necessary directories
mkdir -p certbot-personal/conf/live/YOUR-DOMAIN.com
mkdir -p certbot-personal/www

# Download TLS parameters
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > certbot-personal/conf/options-ssl-nginx.conf
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > certbot-personal/conf/ssl-dhparams.pem

# Start nginx with HTTP-only config for certificate challenge
cp nginx-personal/conf.d/default-http-only.conf nginx-personal/conf.d/default.conf
docker-compose -f docker-compose-ssl-personal.yml up -d nginx

# Wait for nginx
sleep 5

# Request certificate
docker-compose -f docker-compose-ssl-personal.yml run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    --email your-email@example.com \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d YOUR-DOMAIN.com" certbot

# Restore SSL config
cp nginx-personal/conf.d/default.conf nginx-personal/conf.d/default.conf.backup
# Update domain in nginx config
sed -i "s/YOUR_DOMAIN/YOUR-DOMAIN.com/g" nginx-personal/conf.d/default.conf

# Reload nginx
docker-compose -f docker-compose-ssl-personal.yml exec nginx nginx -s reload
```

### 5. Start All Services
**If using standard template:**
```bash
docker-compose up -d
```

**If using personal file:**
```bash
docker-compose -f docker-compose-ssl-personal.yml up -d
```

### 6. Verify SSL
```bash
curl -I https://YOUR-DOMAIN.com
```

## Important Notes

1. **Certificate Auto-renewal**: The certbot container in both setups automatically renews certificates every 12 hours.

2. **Firewall Configuration**: Ensure ports 80 and 443 are open:
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw reload
   ```

3. **Existing Services on Ports 80/443**: If you have other services using these ports, you'll need to stop them first.

4. **Domain Verification**: Your domain must correctly resolve to your server's IP address for Let's Encrypt verification.

## Troubleshooting

### Certificate Request Fails
- Check DNS: `dig +short YOUR-DOMAIN.com`
- Verify port 80 is accessible: `curl -I http://YOUR-DOMAIN.com`
- Check certbot logs: `docker-compose logs certbot`

### Nginx Won't Start
- Test config: `docker-compose exec nginx nginx -t`
- Check for port conflicts: `sudo netstat -tulpn | grep ':80\|:443'`

### HTTPS Not Working
- Check firewall: `sudo ufw status`
- Verify certificate files exist: `ls -la certbot/conf/live/YOUR-DOMAIN.com/`

## Next Steps After SSL Setup

1. Update any bookmarks to use `https://` instead of `http://`
2. Consider setting up monitoring for certificate expiration
3. Regular backups of certificate directory: `tar -czf ssl-backup.tar.gz certbot/`

Your Random Music Server will now be accessible securely at `https://YOUR-DOMAIN.com` with automatic SSL certificate management.
