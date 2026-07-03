# -----------------------------
# Stage 1: Builder (for production)
# -----------------------------
FROM node:20-bullseye AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first for caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy all source files
COPY . .

# Build the production-ready files (Vite outputs to 'dist')
RUN npm run build

# -----------------------------
# Stage 2: Production image (Nginx)
# -----------------------------
FROM nginx:alpine AS prod

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Remove default Nginx config and add your own
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/

# Expose HTTP port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# -----------------------------
# Stage 3: Development (Vite dev server)
# -----------------------------
FROM node:20-bullseye AS dev

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first for caching
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy all source files
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run Vite dev server, accessible from Docker
CMD ["npm", "run", "dev"]
