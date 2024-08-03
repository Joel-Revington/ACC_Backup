#!/bin/bash
# Stop and remove the existing container
docker stop acc_backup || true
docker rm acc_backup || true

# Remove existing Docker image
docker rmi 339713031143.dkr.ecr.ap-south-1.amazonaws.com/acc_backup:latest || true
