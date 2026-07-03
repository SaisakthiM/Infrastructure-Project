# ── Build stage ───────────────────────────────────────────────
FROM maven:3.9.6-eclipse-temurin-21 AS builder
WORKDIR /app

# Cache dependencies separately — only re-downloads when pom.xml changes
COPY pom.xml .
RUN mvn dependency:go-offline -q

# Build the jar — done once at image build time, not on every container start
COPY src ./src
RUN mvn clean package -DskipTests -q

# ── Runtime stage ─────────────────────────────────────────────
# Slim JRE instead of full Maven image — saves ~400MB
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Copy only the built jar — no source, no Maven, no build tools
COPY --from=builder /app/target/bank_management-0.0.1-SNAPSHOT.jar app.jar

# Download agent at build time
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENV JAVA_TOOL_OPTIONS="-javaagent:/app/opentelemetry-javaagent.jar"
ENV OTEL_SERVICE_NAME="bank-backend"
ENV OTEL_EXPORTER_OTLP_ENDPOINT="http://otel-gateway:4317"
ENV OTEL_EXPORTER_OTLP_PROTOCOL="grpc"
ENV OTEL_TRACES_EXPORTER="otlp"
ENV OTEL_METRICS_EXPORTER="otlp"
ENV OTEL_LOGS_EXPORTER="otlp"

EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]