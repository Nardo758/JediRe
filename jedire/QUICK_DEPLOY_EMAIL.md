# Quick Email System Deployment

## Run These Commands on Replit

```bash
# Already done: git pull origin master

# Run FIXED migrations (with UUID support)
psql $DATABASE_URL -f backend/src/database/migrations/006_emails_fixed.sql
psql $DATABASE_URL -f backend/src/database/migrations/007_seed_emails_fixed.sql

# Check it worked
psql $DATABASE_URL -c "SELECT COUNT(*) FROM emails;"
# Should show: 7

# Start backend
cd backend
npm start
```

## What Was Fixed

The original migrations used `INTEGER` for `user_id`, but your database has UUID for users.

**Fixed migrations:**
- `006_emails_fixed.sql` - Uses `UUID` for user foreign keys
- `007_seed_emails_fixed.sql` - Smart seeding (finds first user automatically)

## Verify It Works

```bash
# Check email stats
psql $DATABASE_URL -c "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_read = FALSE) as unread FROM emails;"
```

Should show:
```
 total | unread 
-------+--------
     7 |      4
```

## Frontend

Navigate to: **Dashboard → Email**

Should see:
- 7 emails in sidebar
- Stats card (total: 7, unread: 4, flagged: 3)
- Map with deal markers
