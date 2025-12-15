# Quick Start: SSL Setup

Get your Random Music Server running with HTTPS in 5 minutes.

## Prerequisites Checklist

- [ ] Domain name pointing to your server IP
- [ ] Ports 8080 and 8443 open in firewall
- [ ] Docker and Docker Compose installed
- [ ] Your music directory path ready

## 3-Step Setup

### 1. Configure Music Path

Edit `docker-compose.ssl.yml` line 18:
```yaml
- /path/to/your/music:/music:ro  # Change this!
```

### 2. Make Scripts Executable

```bash
chmod +x init-letsencrypt.sh renew-certificates.sh
```

### 3. Initialize SSL

**For production:**
```bash
./init-letsencrypt.sh your-domain.com your-email@example.com
```

**For testing (recommended first):**
```bash
./init-letsencrypt.sh your-domain.com your-email@example.com 1
```

## Access Your Site

- **HTTP**: `http://your-domain.com:8080` → redirects to HTTPS
- **HTTPS**: `https://your-domain.com:8443` ✅

## Common Commands

```bash
# Start
docker compose -f docker-compose.ssl.yml up -d

# Stop
docker compose -f docker-compose.ssl.yml down

# Logs
docker compose -f docker-compose.ssl.yml logs -f

# Renew certificates manually
./renew-certificates.sh
```

## Troubleshooting

**Certificate request fails?**
1. Check DNS: `dig +short your-domain.com`
2. Check port: `curl http://your-domain.com:8080`
3. Check logs: `docker compose -f docker-compose.ssl.yml logs certbot`

**Nginx won't start?**
1. Test config: `docker compose -f docker-compose.ssl.yml exec nginx nginx -t`
2. Check certificates: `ls -la certbot/conf/live/your-domain.com/`

**Hit rate limits?**
Use staging server (add `1` as third parameter to init script)

## Full Documentation

See `SSL_SETUP.md` for complete documentation.

## Important Notes

- Certificates auto-renew every 12 hours
- Your existing `docker-compose.yml` is unchanged
- All new files are separate from your original setup
- Backup certificates regularly: `tar -czf backup.tar.gz certbot/conf/`
