# #!/bin/bash
# # Stop and remove the existing container
# docker stop acc_backup || true
# docker rm acc_backup || true

# # Remove existing Docker image
# docker rmi 339713031143.dkr.ecr.ap-south-1.amazonaws.com/acc_backup:latest || true

# #!/bin/bash
# # Pull the latest Docker image from ECR
# docker pull 339713031143.dkr.ecr.ap-south-1.amazonaws.com/acc_backup:latest

# #!/bin/bash
# # Run the Docker container
# docker run -d --name acc_backup -p 80:80 339713031143.dkr.ecr.ap-south-1.amazonaws.com/acc_backup:latest

# # Restart NGINX to apply any new configuration
# systemctl restart nginx

#!/bin/bash

# Navigate to the project directory
cd /home/ubuntu/ACC_Backup1

aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 339713031143.dkr.ecr.ap-south-1.amazonaws.com

# Stop and remove the existing containers if any
# docker-compose down || true

# Pull the latest Docker image from ECR
docker compose pull

# Start the Docker container using Docker Compose with an external .env file
docker compose up -d

# Restart NGINX to apply any new configuration
sudo systemctl restart nginx
