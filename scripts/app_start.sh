#!/bin/bash

# Navigate to the project directory
cd /home/ubuntu/ACC_Backup

# Bring down any existing containers
docker-compose down || true

docker-compose pull

# Pull the latest image and start the container
docker-compose up -d

# Restart NGINX to apply any new configuration
systemctl restart nginx
