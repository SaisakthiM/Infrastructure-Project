#!/bin/sh

# Pulling the image
docker pull minio/minio

# Running image
docker run -d \
  --name document-server \
  -p 9000:9000 \
  -p 9001:9001 \
  -v ~/minio-data:/data \
  -e MINIO_ROOT_USER=admin \
  -e MINIO_ROOT_PASSWORD=saisakthi@2008 \
  quay.io/minio/minio server /data --console-address ":9001"


