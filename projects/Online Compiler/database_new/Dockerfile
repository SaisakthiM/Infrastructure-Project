# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM gcc:12-bookworm AS builder

WORKDIR /build

# Copy source
COPY src/ ./src/
COPY Makefile .

# Build the binary
RUN make

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
# Use a minimal image — we only need the compiled binary and glibc
FROM debian:bookworm-slim

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/dbserver .

# Data directory — mount a volume here to persist data across restarts
RUN mkdir -p /app/data

EXPOSE 8080

CMD ["./dbserver"]