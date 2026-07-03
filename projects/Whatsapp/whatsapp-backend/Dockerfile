# Stage 1: Install cargo-chef
FROM rust:1-slim-bookworm AS chef
WORKDIR /app
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
RUN cargo install cargo-chef --locked

# Stage 2: Compute the dependency recipe (only re-runs if Cargo.toml/lock changes)
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# Stage 3: Build dependencies first (heaviest layer — cached unless deps change)
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

# Now copy source and build — only this layer re-runs on src changes
COPY . .
RUN cargo build --release
RUN cargo install sqlx-cli --no-default-features --features postgres --locked

# Stage 4: Minimal runtime (debian-slim matches the glibc the binary was compiled against)
FROM debian:bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/whatsapp-backend .
COPY --from=builder /usr/local/cargo/bin/sqlx .
COPY migrations/ ./migrations/
RUN printf '%s\n' \
    "DATABASE_URL=postgresql://saisakthi:saisakthi2008@localhost:5432/chat" \
    "DATABASE_TEST_URL=postgresql://saisakthi:saisakthi2008@localhost:5432/chat_test" \
    "JWT_SECRET=saisakthi2008" \
    "MINIO_USERNAME=minioadmin" \
    "MINIO_PASSWORD=minioadmin" \
    > .env

EXPOSE 8000
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh
CMD ["./entrypoint.sh"]