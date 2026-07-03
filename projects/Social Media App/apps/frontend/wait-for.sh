# --------- Stage 0: Base Node Image ---------
FROM node:20-bullseye AS base
WORKDIR /app
COPY package*.json ./

# Install dependencies with proper flags for Docker
RUN npm ci --include=optional --legacy-peer-deps

# --------- Stage 1: Dev Frontend (Vite/HMR) ---------
FROM base AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --------- Stage 2: Build Frontend for Production ---------
FROM base AS builder
COPY . .
RUN npm run build

# --------- Stage 3: Serve Production with Nginx ---------
FROM nginx:alpine AS production
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Install netcat for wait-for script
RUN apk add --no-cache netcat-openbsd

# Copy wait-for script
COPY wait-for.sh /wait-for.sh
RUN chmod +x /wait-for.sh

EXPOSE 80

# Use wait-for script to wait for backends before starting nginx
ENTRYPOINT ["/wait-for.sh"]
CMD ["django:8000", "microservice-java:8080", "microservice-go:8080", "minio:9000", "--", "nginx", "-g", "daemon off;"]