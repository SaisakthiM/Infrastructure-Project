# =========================
# Build / Test
# =========================
FROM maven:3.9-eclipse-temurin-21

WORKDIR /app

# Copy dependency definition first
COPY pom.xml .

# Cache Maven dependencies
RUN mvn dependency:go-offline

# Copy tests/source
COPY src ./src

# Run Selenium tests
CMD ["mvn", "test"]