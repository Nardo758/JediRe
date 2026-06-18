#!/bin/bash
set -e
BASE_URL="http://localhost:3000/api/v1"
AUTH_HEADER="Authorization: Bearer YOUR_JWT_TOKEN"

echo "=== Step 1: Find a seeded deal ==="
DEAL_ID=$(psql "$DATABASE_URL" -t -c "SELECT deal_id FROM deal_assumptions WHERE year1 IS NOT NULL LIMIT 1;" | xargs)
[ -z "$DEAL_ID" ] && echo "No seeded deal found" && exit 1
echo "Deal: $DEAL_ID"

echo "=== Step 2: Baseline ==="
BASE=$(curl -s -H "$AUTH_HEADER" "$BASE_URL/deals/$DEAL_ID/financials")
node -e "const d=JSON.parse(process.argv[1]); const y1=d.proforma?.year1||[]; const g=f=>y1.find(r=>r.field===f)?.resolved??'NULL'; console.log({oi:g('other_income'), egi:g('egi'), noi:g('noi')});" "$BASE"

echo "=== Step 3: Add +$500/month line ==="
ADD=$(curl -s -X POST -H "$AUTH_HEADER" -H "Content-Type: application/json" -d '{"label":"Test Solar","monthly":500,"source":"operator"}' "$BASE_URL/deals/$DEAL_ID/assumptions/other_income_user_lines")
LINE_ID=$(node -e "const d=JSON.parse(process.argv[1]); console.log(d.user_lines?.at(-1)?.id??'');" "$ADD")
echo "Line ID: $LINE_ID"

echo "=== Step 4: Post-add ==="
POST=$(curl -s -H "$AUTH_HEADER" "$BASE_URL/deals/$DEAL_ID/financials")
node -e "const d=JSON.parse(process.argv[1]); const y1=d.proforma?.year1||[]; const g=f=>y1.find(r=>r.field===f)?.resolved??'NULL'; console.log({oi:g('other_income'), egi:g('egi'), noi:g('noi')});" "$POST"

echo "=== Step 5: Delete line ==="
[ -n "$LINE_ID" ] && curl -s -X DELETE -H "$AUTH_HEADER" "$BASE_URL/deals/$DEAL_ID/assumptions/other_income_user_lines/$LINE_ID" && echo "Deleted"

echo "=== Step 6: Post-delete ==="
POST2=$(curl -s -H "$AUTH_HEADER" "$BASE_URL/deals/$DEAL_ID/financials")
node -e "const d=JSON.parse(process.argv[1]); const y1=d.proforma?.year1||[]; const g=f=>y1.find(r=>r.field===f)?.resolved??'NULL'; console.log({oi:g('other_income'), egi:g('egi'), noi:g('noi')});" "$POST2"

echo "=== Done ==="
