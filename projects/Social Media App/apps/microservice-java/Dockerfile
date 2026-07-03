# --------------------------
# Stage 1: Build the JAR
# --------------------------
FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /app

# Copy pom and wrapper first for caching
COPY pom.xml .
COPY mvnw .
RUN mkdir -p .mvn/wrapper
RUN cat <<EOF > /app/.mvn/wrapper/maven-wrapper.properties
wrapperVersion=3.3.4
distributionType=only-script
distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/apache-maven-3.9.11-bin.zip
EOF

# Download dependencies offline
RUN chmod +x mvnw && ./mvnw dependency:go-offline

# Copy source and build
COPY src ./src
RUN ./mvnw clean package -DskipTests

# --------------------------
# Stage 2: Runtime
# --------------------------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Install tools needed for wait script
RUN apk add --no-cache bash curl netcat-openbsd coreutils

# Copy the built jar from the build stage
COPY --from=build /app/target/*.jar /app/

# Copy the wait-for-cassandra script
COPY wait-for-cassandra.sh /wait-for-cassandra.sh
RUN chmod +x /wait-for-cassandra.sh

# Download the agent at build time
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar

ENV JAVA_TOOL_OPTIONS="-javaagent:/app/opentelemetry-javaagent.jar"
ENV OTEL_SERVICE_NAME="bank-backend"
ENV OTEL_EXPORTER_OTLP_ENDPOINT="http://otel-gateway:4317"
ENV OTEL_EXPORTER_OTLP_PROTOCOL="grpc"
ENV OTEL_TRACES_EXPORTER="otlp"
ENV OTEL_METRICS_EXPORTER="otlp"
ENV OTEL_LOGS_EXPORTER="otlp"

# Run the wait script, which launches the JAR
ENTRYPOINT ["/wait-for-cassandra.sh"]
