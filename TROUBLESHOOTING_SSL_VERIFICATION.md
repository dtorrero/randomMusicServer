# Troubleshooting SSL Certificate Verification Failure

The SSL setup is failing because Let's Encrypt cannot verify your domain ownership. The error "Connection reset by peer" indicates that Let's Encrypt's servers cannot reach your nginx server on port 80.

## Quick Diagnostic Tests

### 1. Check if Port 80 is Accessible Locally
```bash
# Test nginx locally
curl -I http://localhost/.well-known/acme-challenge/test

# Test from another machine on your local network
# Replace SERVER_IP with your server's local IP
curl -I http://SERVER_IP/.well-known/acme-challenge/test
```

### 2. Check if Port 80 is Accessible from Internet
```bash
# Use an external service to test (from another device or using curl if available)
# Or visit in browser: http://randomplayer.duckdns.org/.well-known/acme-challenge/test
```

### 3. Verify DuckDNS Configuration
```bash
# Check what IP your domain resolves to
nslookup randomplayer.duckdns.org
dig +short randomplayer.duckdns.org

# Compare with your public IP
curl ifconfig.me
curl icanhazip.com
```

### 4. Check Nginx is Serving ACME Challenges
```bash
# Check nginx logs
podman logs nginx-ssl-proxy

# Test the ACME challenge path manually
podman exec nginx-ssl-proxy ls -la /var/www/certbot/.well-known/acme-challenge/

# Create a test file
echo "test" | podman exec -i nginx-ssl-proxy tee /var/www/certbot/.well-known/acme-challenge/test

# Access it locally
curl http://localhost/.well-known/acme-challenge/test
```

## Common Issues and Solutions

### Issue 1: Firewall Blocking Port 80
```bash
# Check firewall rules
sudo firewall-cmd --list-all
sudo iptables -L -n

# If using ufw
sudo ufw status verbose

# Allow port 80 if not already allowed
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

### Issue 2: ISP Blocking Port 80
Many residential ISPs block incoming port 80. Solutions:
1. **Use a different port** (8080) and port forward
2. **Use a VPS or cloud server** that allows port 80
3. **Contact your ISP** to unblock port 80 (unlikely for residential)

### Issue 3: Router/NAT Not Forwarding Port 80
If behind a router:
1. **Log into your router admin** (usually 192.168.1.1 or 192.168.0.1)
2. **Set up port forwarding**:
   - External port: 80 → Internal port: 80 → Internal IP: [your server's IP]
   - External port: 443 → Internal port: 443 → Internal IP: [your server's IP]
3. **Enable DMZ** (temporary test only) to your server's IP

### Issue 4: Cloud Provider Firewall
If using AWS, DigitalOcean, etc.:
1. **Check security groups/firewall rules**
2. **Allow inbound traffic on ports 80 and 443**
3. **Check network ACLs**

## Alternative Solutions

### Solution A: Use DNS-01 Challenge Instead of HTTP-01
DNS-01 challenge doesn't require port 80. However, it requires API access to your DNS provider (DuckDNS supports this).

**Using DuckDNS with DNS-01:**
```bash
# You would need to modify the certbot command to use DNS-01
# This requires DuckDNS API token
certbot certonly --manual --preferred-challenges dns \
  -d randomplayer.duckdns.org \
  --manual-auth-hook /path/to/duckdns-auth-hook.sh \
  --manual-cleanup-hook /path/to/duckdns-cleanup.sh
```

### Solution B: Use Cloudflare Tunnel or Reverse Proxy
Use a service that doesn't require opening ports:
1. **Cloudflare Tunnel** (free)
2. **ngrok** (limited free tier)
3. **LocalXpose** or **bore.pub**

### Solution C: Use a Different Domain Provider
Some domain providers offer free SSL or easier verification.

## Immediate Workaround: Test with Self-Signed Certificate

If you just want HTTPS for testing:
```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certbot/conf/live/randomplayer.duckdns.org/privkey.pem \
  -out certbot/conf/live/randomplayer.duckdns.org/fullchain.pem \
  -subj "/CN=randomplayer.duckdns.org"

# Update nginx to use self-signed cert
# Edit nginx/conf.d-standard-ports/default.conf
# Ensure it points to your certificate files

# Restart nginx
podman restart nginx-ssl-proxy
```

## Verification Steps

After fixing the issue, test again:

1. **Run the SSL setup script**:
   ```bash
   ./init-letsencrypt-standard-ports-podman.sh randomplayer.duckdns.org david.torrero@gmail.com 1
   ```

2. **Check certificate**:
   ```bash
   ls -la certbot/conf/live/randomplayer.duckdns.org/
   ```

3. **Test HTTPS**:
   ```bash
   curl -I https://randomplayer.duckdns.org
   ```

## Most Likely Cause

Based on the error "Connection reset by peer", the most likely issues are:
1. **Residential ISP blocking port 80** (very common)
2. **Router not forwarding port 80** to your server
3. **Local firewall** on the server

**Recommended action**: Test if you can access `http://randomplayer.duckdns.org` from outside your network (use mobile data or ask a friend). If not, you likely need to configure port forwarding on your router or use an alternative solution like DNS-01 challenge.
