# Complete Import Script for Replit

Copy and paste these commands in your Replit Shell, one section at a time.

---

## STEP 1: Create Migration File

```bash
cd ~/workspace/jedire
mkdir -p backend/src/database/migrations backend/src/scripts
```

Copy the migration file content from the next message, then:

```bash
cat > backend/src/database/migrations/040_property_records.sql
# Paste the SQL content, then press Ctrl+D
```

---

## STEP 2: Run Migration

```bash
psql $DATABASE_URL -f backend/src/database/migrations/040_property_records.sql
```

Expected output: Bunch of "CREATE TABLE", "CREATE INDEX", "GRANT" messages

---

## STEP 3: Create Import Script

Copy the TypeScript script content from the message after migration, then:

```bash
cat > backend/src/scripts/import-fulton-properties.ts
# Paste the TypeScript content, then press Ctrl+D
```

---

## STEP 4: Install pg Module (if needed)

```bash
cd backend
npm install pg
```

---

## STEP 5: Run Import

```bash
tsx src/scripts/import-fulton-properties.ts
```

This will take ~5-10 minutes. Watch for:
- Property imports
- Sales history
- Market trends

---

## STEP 6: Verify Data

```bash
psql $DATABASE_URL << 'EOF'
SELECT COUNT(*) FROM property_records;
SELECT COUNT(*) FROM property_sales;
SELECT COUNT(*) FROM market_trends;
EOF
```

---

## What You'll Get

**Properties:** ~40-60 large multifamily (100+ units)
**Sales:** Individual transactions 2018-2022
**Market Data:** City median prices 2012-2024
**Analysis:** Year-built cohort capabilities

---

Ready to paste the files? 🚀
