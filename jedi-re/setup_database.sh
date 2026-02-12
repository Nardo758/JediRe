#!/bin/bash
# JEDI RE Database Setup Script
# This script sets up PostgreSQL 15 + TimescaleDB for the JEDI RE platform

set -e

echo "========================================="
echo "JEDI RE Database Setup"
echo "========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run this script with sudo or as root"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    echo "Cannot detect OS"
    exit 1
fi

echo "Detected OS: $OS $VER"

# Install PostgreSQL 15 based on OS
case $ID in
    ubuntu|debian)
        echo "Installing PostgreSQL 15 on Ubuntu/Debian..."
        
        # Add PostgreSQL repository
        apt-get update
        apt-get install -y wget curl gnupg lsb-release
        
        # Create PostgreSQL repository configuration
        sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
        
        # Import repository signing key
        wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
        
        # Update and install
        apt-get update
        apt-get install -y postgresql-15 postgresql-contrib-15 postgresql-15-postgis-3
        
        # Install TimescaleDB
        echo "Installing TimescaleDB..."
        apt-get install -y gnupg2
        wget --quiet -O - https://packagecloud.io/timescale/timescaledb/gpgkey | apt-key add -
        
        # Add TimescaleDB repository
        sh -c 'echo "deb https://packagecloud.io/timescale/timescaledb/ubuntu/ $(lsb_release -c -s) main" > /etc/apt/sources.list.d/timescaledb.list'
        
        apt-get update
        apt-get install -y timescaledb-2-postgresql-15
        
        # Configure TimescaleDB
        timescaledb-tune --quiet --yes
        
        ;;
        
    fedora|centos|rhel)
        echo "Installing PostgreSQL 15 on RHEL/CentOS/Fedora..."
        
        # Install PostgreSQL 15
        dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-x86_64/pgdg-redhat-repo-latest.noarch.rpm
        dnf -qy module disable postgresql
        dnf install -y postgresql15-server postgresql15-contrib postgis31_15
        
        # Initialize database
        /usr/pgsql-15/bin/postgresql-15-setup initdb
        
        # Install TimescaleDB
        tee /etc/yum.repos.d/timescale_timescaledb.repo <<EOL
[timescale_timescaledb]
name=timescale_timescaledb
baseurl=https://packagecloud.io/timescale/timescaledb/el/$(rpm -E %{rhel})/\$basearch
repo_gpgcheck=1
gpgcheck=0
enabled=1
gpgkey=https://packagecloud.io/timescale/timescaledb/gpgkey
sslverify=1
sslcacert=/etc/pki/tls/certs/ca-bundle.crt
metadata_expire=300
EOL
        
        dnf install -y timescaledb-2-postgresql-15
        
        # Configure TimescaleDB
        timescaledb-tune --quiet --yes
        
        ;;
        
    *)
        echo "Unsupported OS: $ID"
        echo "Please install PostgreSQL 15 and TimescaleDB manually"
        exit 1
        ;;
esac

# Start and enable PostgreSQL
echo "Starting PostgreSQL service..."
systemctl enable postgresql-15
systemctl start postgresql-15

# Wait for PostgreSQL to start
sleep 5

echo "========================================="
echo "Database Configuration"
echo "========================================="

# Create database and user
sudo -u postgres psql <<EOF
-- Create database
CREATE DATABASE jedire;

-- Connect to database
\c jedire

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Enable PostGIS for geographic data
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create application user (optional)
CREATE USER jedire_user WITH PASSWORD 'jedire_password';
GRANT ALL PRIVILEGES ON DATABASE jedire TO jedire_user;

-- Exit
\q
EOF

echo "Database 'jedire' created successfully!"

# Run schema
echo "Loading schema..."
sudo -u postgres psql -d jedire -f /home/leon/clawd/jedi-re/src/database_schema.sql

echo "========================================="
echo "Inserting Sample Data"
echo "========================================="

# Insert sample data
sudo -u postgres psql -d jedire -f /home/leon/clawd/jedi-re/sample_data.sql

echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Connection details:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: jedire"
echo "  Username: postgres (or jedire_user)"
echo "  Password: (system password for postgres, or 'jedire_password' for jedire_user)"
echo ""
echo "To connect using psql:"
echo "  sudo -u postgres psql -d jedire"
echo ""
echo "To verify setup, run:"
echo "  psql -h localhost -U postgres -d jedire -c \"SELECT COUNT(*) FROM submarkets;\""
echo "  psql -h localhost -U postgres -d jedire -c \"SELECT COUNT(*) FROM properties;\""
echo "  psql -h localhost -U postgres -d jedire -c \"SELECT COUNT(*) FROM rents_timeseries;\""
echo ""
echo "For pgAdmin web interface (if installed):"
echo "  http://localhost:5050 (if using Docker)"
echo "  Username: admin@jedire.com"
echo "  Password: admin123"