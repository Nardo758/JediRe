# JEDI RE Database Setup Guide

This guide covers setting up PostgreSQL 15 with TimescaleDB for the JEDI RE (Real Estate Intelligence) platform.

## 📋 Prerequisites

### Option A: System Installation (Recommended for Production)
- Ubuntu/Debian or RHEL/CentOS/Fedora system
- Sudo/root access
- At least 4GB RAM, 20GB disk space

### Option B: Docker Installation (Recommended for Development)
- Docker installed
- Docker Compose installed
- At least 4GB RAM, 20GB disk space

## 🚀 Quick Start

### Using Docker (Easiest)
```bash
cd /home/leon/clawd/jedi-re
chmod +x setup_docker.sh
./setup_docker.sh
```

### Using System Packages
```bash
cd /home/leon/clawd/jedi-re
chmod +x setup_database.sh
sudo ./setup_database.sh
```

## 📊 Database Schema Overview

The database includes:

### Core Tables
- `submarkets` - Geographic trade areas with demographics
- `properties` - Multifamily assets with details
- `rents_timeseries` - Weekly rent data (TimescaleDB hypertable)
- `supply_pipeline` - Construction pipeline tracking

### Timeseries Tables (TimescaleDB)
- `rents_timeseries` - Rent and occupancy data
- `traffic_proxies` - Traffic count data
- `search_trends` - Market search trends

### Signal Tables
- `demand_signals` - Demand analysis results
- `supply_signals` - Supply analysis results  
- `imbalance_signals` - Combined market signals

### User & Collaboration
- `users` - Platform users
- `deal_silos` - User deal tracking
- Collaboration tables for team workflows

### Views
- `latest_rents` - Latest rent data per property
- `submarket_supply_summary` - Supply/demand overview

## 🔧 Manual Setup Instructions

### 1. Install PostgreSQL 15 + TimescaleDB

#### Ubuntu/Debian:
```bash
# Add PostgreSQL repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Add TimescaleDB repository
sudo sh -c 'echo "deb https://packagecloud.io/timescale/timescaledb/ubuntu/ $(lsb_release -c -s) main" > /etc/apt/sources.list.d/timescaledb.list'
wget --quiet -O - https://packagecloud.io/timescale/timescaledb/gpgkey | sudo apt-key add -

# Install
sudo apt update
sudo apt install -y postgresql-15 postgresql-contrib-15 timescaledb-2-postgresql-15 postgresql-15-postgis-3

# Configure TimescaleDB
sudo timescaledb-tune --quiet --yes
sudo systemctl restart postgresql
```

#### RHEL/CentOS/Fedora:
```bash
# Install PostgreSQL 15
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-x86_64/pgdg-redhat-repo-latest.noarch.rpm
sudo dnf -qy module disable postgresql
sudo dnf install -y postgresql15-server postgresql15-contrib

# Initialize database
sudo /usr/pgsql-15/bin/postgresql-15-setup initdb

# Install TimescaleDB
sudo tee /etc/yum.repos.d/timescale_timescaledb.repo <<EOL
[timescale_timescaledb]
name=timescale_timescaledb
baseurl=https://packagecloud.io/timescale/timescaledb/el/\$(rpm -E %{rhel})/\$basearch
repo_gpgcheck=1
gpgcheck=0
enabled=1
gpgkey=https://packagecloud.io/timescale/timescaledb/gpgkey
sslverify=1
sslcacert=/etc/pki/tls/certs/ca-bundle.crt
metadata_expire=300
EOL

sudo dnf install -y timescaledb-2-postgresql-15
sudo timescaledb-tune --quiet --yes
sudo systemctl enable postgresql-15
sudo systemctl start postgresql-15
```

### 2. Create Database and Load Schema

```bash
# Create database
sudo -u postgres psql -c "CREATE DATABASE jedire;"

# Enable extensions
sudo -u postgres psql -d jedire -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
sudo -u postgres psql -d jedire -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Load schema
sudo -u postgres psql -d jedire -f /home/leon/clawd/jedi-re/src/database_schema.sql

# Load sample data
sudo -u postgres psql -d jedire -f /home/leon/clawd/jedi-re/sample_data.sql
```

### 3. Create Application User (Optional)

```bash
sudo -u postgres psql -d jedire <<EOF
CREATE USER jedire_user WITH PASSWORD 'jedire_password';
GRANT ALL PRIVILEGES ON DATABASE jedire TO jedire_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO jedire_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO jedire_user;
EOF
```

## 🐳 Docker Setup

### Using docker-compose.yml

```yaml
# File: docker-compose.yml
version: '3.8'

services:
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
    command: >
      postgres
      -c shared_preload_libraries=timescaledb
      -c timescaledb.telemetry_level=off

volumes:
  postgres_data:
    driver: local
```

### Start Docker Container
```bash
docker-compose up -d
```

## 📝 Sample Data Included

The setup includes sample data for:

1. **Submarket**: Buckhead, Atlanta
   - Population: 105,000
   - Median income: $125,000
   - Growth rate: 1.85%

2. **Property**: The Sovereign at Buckhead
   - 350 luxury units
   - Built in 2019
   - Class A vintage

3. **Rent Data**: 12 weeks of simulated data
   - Weekly rent trends
   - Occupancy rates (94.5-97.5%)
   - Seasonal concessions

4. **Market Signals**
   - Demand signal: STRONG (82/100)
   - Supply signal: MODERATE_UNDERSUPPLY (68/100)
   - Imbalance signal: STRONG_OPPORTUNITY (75/100)

5. **Additional Data**
   - Supply pipeline project
   - Traffic proxy data
   - Search trend data
   - Sample user and deal

## 🔗 Connection Details

### Default Connection
```
Host: localhost
Port: 5432
Database: jedire
Username: postgres
Password: jedire123
Connection String: postgresql://postgres:jedire123@localhost:5432/jedire
```

### Application Connection
```
Username: jedire_user
Password: jedire_password
Connection String: postgresql://jedire_user:jedire_password@localhost:5432/jedire
```

## ✅ Verification

### Basic Verification
```bash
# Connect to database
psql -h localhost -U postgres -d jedire

# Run verification queries
\i /home/leon/clawd/jedi-re/verify_setup.sql
```

### Quick Verification Commands
```bash
# Check table counts
psql -h localhost -U postgres -d jedire -c "SELECT COUNT(*) FROM submarkets;"
psql -h localhost -U postgres -d jedire -c "SELECT COUNT(*) FROM properties;"
psql -h localhost -U postgres -d jedire -c "SELECT COUNT(*) FROM rents_timeseries;"

# Check sample data
psql -h localhost -U postgres -d jedire -c "SELECT * FROM submarkets;"
psql -h localhost -U postgres -d jedire -c "SELECT name, address, total_units FROM properties;"
psql -h localhost -U postgres -d jedire -c "SELECT * FROM latest_rents LIMIT 5;"
```

### Expected Output
```
 submarkets | 1
 properties | 1
 rents_timeseries | 12
 latest_rents | 1
 supply_pipeline | 1
 traffic_proxies | 7
 search_trends | 12
 demand_signals | 1
 supply_signals | 1
 imbalance_signals | 1
 users | 1
 deal_silos | 1
```

## 🛠️ Troubleshooting

### Common Issues

1. **PostgreSQL not starting**
   ```bash
   sudo systemctl status postgresql-15
   sudo journalctl -u postgresql-15 -f
   ```

2. **TimescaleDB extension error**
   ```bash
   # Check if extension is loaded
   sudo -u postgres psql -d jedire -c "SELECT * FROM pg_extension;"
   
   # Load extension manually
   sudo -u postgres psql -d jedire -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
   ```

3. **Permission denied errors**
   ```bash
   # Fix PostgreSQL data directory permissions
   sudo chown -R postgres:postgres /var/lib/postgresql
   sudo chmod -R 750 /var/lib/postgresql
   ```

4. **Docker port conflicts**
   ```bash
   # Check if port 5432 is in use
   sudo netstat -tlnp | grep :5432
   
   # Change port in docker-compose.yml
   # ports: - "5433:5432"
   ```

### Reset Database
```bash
# Drop and recreate
sudo -u postgres psql -c "DROP DATABASE IF EXISTS jedire;"
sudo -u postgres psql -c "CREATE DATABASE jedire;"
sudo -u postgres psql -d jedire -f /home/leon/clawd/jedi-re/src/database_schema.sql
sudo -u postgres psql -d jedire -f /home/leon/clawd/jedi-re/sample_data.sql
```

## 📈 Example Queries

### Market Analysis
```sql
-- Rent growth calculation
SELECT 
    DATE_TRUNC('week', timestamp) as week,
    AVG(weighted_avg) as avg_rent,
    AVG(occupancy_pct) as avg_occupancy
FROM rents_timeseries rt
JOIN properties p ON rt.property_id = p.id
WHERE p.name = 'The Sovereign at Buckhead'
GROUP BY DATE_TRUNC('week', timestamp)
ORDER BY week DESC
LIMIT 12;

-- Submarket supply/demand balance
SELECT 
    s.name as submarket,
    isig.verdict,
    isig.composite_score,
    ds.signal_strength as demand,
    ss.signal_strength as supply
FROM imbalance_signals isig
JOIN submarkets s ON isig.submarket_id = s.id
JOIN demand_signals ds ON isig.demand_signal_id = ds.id
JOIN supply_signals ss ON isig.supply_signal_id = ss.id
ORDER BY isig.composite_score DESC;
```

### TimescaleDB Specific
```sql
-- Hypertable information
SELECT * FROM timescaledb_information.hypertables;

-- Chunk information
SELECT * FROM timescaledb_information.chunks 
WHERE hypertable_name = 'rents_timeseries';

-- Time-based aggregation
SELECT 
    time_bucket('1 week', timestamp) as week,
    AVG(weighted_avg) as avg_rent,
    AVG(occupancy_pct) as avg_occupancy
FROM rents_timeseries
GROUP BY time_bucket('1 week', timestamp)
ORDER BY week DESC;
```

## 🔐 Security Notes

1. **Change default passwords** in production
2. **Use environment variables** for sensitive data
3. **Configure firewall** to restrict database access
4. **Enable SSL** for remote connections
5. **Regular backups** of the database

## 📚 Additional Resources

- [TimescaleDB Documentation](https://docs.timescale.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/15/)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Docker PostgreSQL Guide](https://docs.docker.com/samples/postgresql/)

## 🆘 Support

For issues with this setup:
1. Check the troubleshooting section
2. Verify all prerequisites are met
3. Check system logs for errors
4. Ensure sufficient disk space and memory

---

*Last updated: $(date)*
*JEDI RE Platform - Real Estate Intelligence Database*