# ---- Build stage ----
FROM golang:1.25 AS builder

ENV CGO_ENABLED=0 GOOS=linux GOARCH=amd64
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build main microservice
RUN go build -o microservice-go ./main.go
# Build wait-for-redis binary
RUN go build -o wait-for-redis ./wait-for-redis/wait-for-redis.go

# ---- Runtime stage ----
FROM gcr.io/distroless/base-debian12

WORKDIR /app
COPY --from=builder /app/microservice-go .
COPY --from=builder /app/wait-for-redis .

ENTRYPOINT ["/app/wait-for-redis", "/app/microservice-go"]
