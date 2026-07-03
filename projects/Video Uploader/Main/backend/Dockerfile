# Stage 1 — Build
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn clean package -DskipTests -B

# Stage 2 — Download OTEL agent separately so it's cached independently
FROM eclipse-temurin:21-jre-alpine AS agent
RUN apk add --no-cache curl
RUN curl -L -o /opentelemetry-javaagent.jar \
    https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar

# Stage 3 — Run
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY --from=builder /app/target/*.jar app.jar
COPY --from=agent /opentelemetry-javaagent.jar opentelemetry-javaagent.jar

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENV JAVA_TOOL_OPTIONS="-javaagent:/app/opentelemetry-javaagent.jar"
ENV OTEL_SERVICE_NAME="video-backend"
ENV OTEL_EXPORTER_OTLP_ENDPOINT="http://otel-gateway:4317"
ENV OTEL_EXPORTER_OTLP_PROTOCOL="grpc"
ENV OTEL_TRACES_EXPORTER="otlp"
ENV OTEL_METRICS_EXPORTER="otlp"
ENV OTEL_LOGS_EXPORTER="otlp"

EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]