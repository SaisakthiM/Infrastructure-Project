FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY *.json .
RUN npm install
RUN npm install axios

COPY . .
RUN npm test

RUN npm run build



FROM alpine:latest
COPY --from=builder /app/dist /dist
CMD ["sh", "-c", "cp -r /dist/. /output/"]