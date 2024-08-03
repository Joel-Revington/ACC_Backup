#!/bin/bash
# Run the Docker container
docker run -d --name acc_backup -p 80:80 339713031143.dkr.ecr.ap-south-1.amazonaws.com/acc_backup:latest

# Restart NGINX to apply any new configuration
systemctl restart nginx
