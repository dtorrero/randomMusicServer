#!/bin/bash

# Diagnostic script for nginx not serving on port 80
echo "=== Diagnosing Nginx Port 80 Issue ==="

# 1. Check if nginx container is running
echo "1. Checking nginx container status..."
podman ps | grep nginx-ssl-proxy

# 2. Check nginx logs
echo -e "\n2. Checking nginx logs (last 20 lines)..."
podman logs nginx-ssl-proxy --tail=20

# 3. Check if nginx process is running inside container
echo -e "\n3. Checking processes inside nginx container..."
podman exec nginx-ssl-proxy ps aux | grep nginx

# 4. Test nginx configuration
echo -e "\n4. Testing nginx configuration..."
podman exec nginx-ssl-proxy nginx -t

# 5. Check port binding
echo -e "\n5. Checking port binding on host..."
sudo ss -tulpn | grep ':80\|:443'

# 6. Check container port mapping
echo -e "\n6. Checking container port mapping..."
podman port nginx-ssl-proxy

# 7. Test local connection to nginx
echo -e "\n7. Testing connection to nginx..."
timeout 2 curl -I http://localhost/.well-known/acme-challenge/test 2>&1 || echo "Curl failed or timed out"

# 8. Check nginx error log
echo -e "\n8. Checking nginx error log..."
podman exec nginx-ssl-proxy tail -n 10 /var/log/nginx/error.log 2>/dev/null || echo "Error log not found or empty"

# 9. Check nginx access log
echo -e "\n9. Checking nginx access log..."
podman exec nginx-ssl-proxy tail -n 5 /var/log/nginx/access.log 2>/dev/null || echo "Access log not found or empty"

# 10. Check mounted volumes
echo -e "\n10. Checking mounted volumes in nginx container..."
podman inspect nginx-ssl-proxy --format='{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'

echo -e "\n=== Diagnostic Complete ==="
echo "Common issues:"
echo "1. Nginx failed to start inside container (check logs)"
echo "2. Port 80 already in use by another service"
echo "3. SELinux blocking (on RHEL/Fedora)"
echo "4. Wrong nginx configuration"
echo "5. Container networking issue"
