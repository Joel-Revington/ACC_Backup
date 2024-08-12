#!/bin/bash
# Stop and remove the existing container
docker stop acc_backup || true
docker rm acc_backup || true

# Remove existing Docker image
docker rmi 339713031143.dkr.ecr.ap-south-1.amazonaws.com/acc_backup:latest || true

#!/bin/bash
# Pull the latest Docker image from ECR
docker pull 339713031143.dkr.ecr.ap-south-1.amazonaws.com/acc_backup:latest

#!/bin/bash
# Run the Docker container
docker run -d --name acc_backup -p 80:80 339713031143.dkr.ecr.ap-south-1.amazonaws.com/acc_backup:latest

# Restart NGINX to apply any new configuration
systemctl restart nginx