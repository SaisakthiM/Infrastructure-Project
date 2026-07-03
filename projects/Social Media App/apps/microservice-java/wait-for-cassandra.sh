#!/bin/sh

echo "Waiting for Cassandra to be available..."
until nc -z cassandra 9042; do
  echo "Cassandra not ready yet..."
  sleep 2
done
echo "Cassandra is up! Starting microservice..."

# FIX: Run the application jar — JAVA_TOOL_OPTIONS already attaches the agent.
# Previously the entrypoint was running opentelemetry-javaagent.jar directly
# which just prints its version and exits with code 0.
exec java -jar /app/sai-java-0.0.1-SNAPSHOT.jar