# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM gcc:12-bookworm AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY src/ ./src/
COPY main.cpp .
COPY Makefile .

RUN make

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 \
    python3 \
    bash \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/server .

VOLUME ["/app/data"]

EXPOSE 9090

CMD ["./server"]