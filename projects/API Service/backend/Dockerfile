FROM node:24-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# exchange prices and portfolios live here: mount a volume to keep them across restarts
ENV DATA_DIR=/data
# nginx proxies to api-service-backend:8000 (bin/www defaults to 8000 too; set explicitly)
ENV PORT=8000
EXPOSE 8000
VOLUME ["/data"]

CMD ["node", "./bin/www"]
