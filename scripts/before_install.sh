#!/bin/bash

# Remove existing package-lock.json if it exists
if [ -f /home/ubuntu/package-lock.json ]; then
  echo "Removing existing package-lock.json"
  rm /home/ubuntu/package-lock.json
fi
