#!/bin/bash
# JEDI RE Docker Database Setup Script
# This script sets up PostgreSQL + TimescaleDB using Docker

set -e

echo "========================================="
echo "JEDI RE Docker Database Setup"
echo "========================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "Docker Compose is not installed. Please install Docker Compose."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "Creating docker-compose.yml for TimescaleDB..."

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  # PostgreSQL with TimescaleDB
  postgres:
    image: timescale/timescaledb:latest-pg15
    container_name: jedire-timescale
    environment:
      POSTGRES_DB: jedire
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: jedire123
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./src/database_schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
      - ./sample_data.sql:/docker-entrypoint-initdb.d/02-sample-data.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    command: >
      postgres
      -c shared_preload_libraries=timescaledb
      -c timescaledb.telemetry_level=off

  # pgAdmin (optional)
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: jedire-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@jedire.com
      PGADMIN_DEFAULT_PASSWORD: admin123
      PGADMIN_CONFIG_SERVER_MODE: 'False'
    ports:
      - "5050:80"
    depends_on:
      - postgres

volumes:
  postgres_data:
    driver: local
EOF

echo "Starting Docker containers..."
docker-compose up -d

# Wait for containers to start
echo "Waiting for database to be ready..."
sleep 10

# Check if database is running
if docker exec jedire-timescale pg_isready -U postgres; then
    echo "Database is running!"
else
    echo "Database failed to start. Check logs with: docker-compose logs postgres"
    exit 1
fi

echo "========================================="
echo "Docker Setup Complete!"
echo "========================================="
echo ""
echo "Containers running:"
echo "  1. PostgreSQL + TimescaleDB (jedire-timescale)"
echo "  2. pgAdmin web interface (jedire-pgadmin) - optional"
echo ""
echo "Connection details:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: jedire"
echo "  Username: postgres"
echo "  Password: jedire123"
echo ""
echo "pgAdmin web interface:"
echo "  URL: http://localhost:5050"
echo "  Email: admin@jedire.com"
echo "  Password: admin123"
echo ""
echo "To add database in pgAdmin:"
echo "  1. Login to pgAdmin"
echo "  2. Right-click 'Servers' → 'Register' → 'Server'"
echo "  3. Name: jedire"
echo "  4. Connection tab:"
echo "     - Host: postgres (or localhost if not using Docker network)"
echo "     - Port: 5432"
echo "     - Username: postgres"
echo "     - Password: jedire123"
echo ""
echo "Useful commands:"
echo "  View logs: docker-compose logs -f postgres"
echo "  Stop containers: docker-compose down"
echo "  Start containers: docker-compose up -d"
echo "  Remove everything: docker-compose down -v"
echo ""
echo "To connect using psql:"
echo "  docker exec -it jedire-timescale psql -U postgres -d jedire"
echo ""
echo "Verification queries:"
echo "  docker exec jedire-timescale psql -U postgres -d jedire -c \"SELECT COUNT(*) FROM submarkets;\""
echo "  docker exec jedire-timescale psql -U postgres -d jedire -c \"SELECT COUNT(*) FROM properties;\""
echo "  docker exec jedire-timescale psql -U postgres -d jedire -c \"SELECT COUNT(*) FROM rents_timeseries;\""
echo "  docker exec jedire-timescale psql -U postgres -d jedire -c \"SELECT * FROM latest_rents LIMIT 5;\""