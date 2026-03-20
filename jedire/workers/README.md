# Municode Scraper - Cloudflare Worker

**Scrapes zoning districts from Municode using Cloudflare Workers**

---

## 🌐 Why Cloudflare Workers?

**Benefits over local scraping:**
- ✅ **Distributed** - Runs on Cloudflare's global network
- ✅ **Fast** - Low latency from anywhere
- ✅ **Scalable** - Can handle 26 cities in parallel
- ✅ **No infrastructure** - No servers to maintain
- ✅ **Cost-effective** - First 100K requests/day FREE

**vs Local Playwright:**
- ❌ Playwright requires headless browser (CPU/memory intensive)
- ❌ Takes 4-6 hours to scrape 26 cities sequentially
- ✅ Worker uses simple HTTP fetch (lightweight)
- ✅ Can scrape 26 cities in parallel in ~1-2 minutes

---

## 📦 What's Included

**Worker Script:**
- `municode-scraper.js` - Cloudflare Worker code
- `wrangler.toml` - Deployment configuration

**Backend Integration:**
- `municode-worker-client.ts` - Service to call worker
- `scrape-via-worker.ts` - CLI tool

---

## 🚀 Deployment Steps

### 1. Install Wrangler CLI (1 minute)

```bash
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### 2. Deploy Worker (30 seconds)

```bash
cd workers
wrangler deploy
```

Output:
```
✨ Built successfully!
🌍 Deployed municode-scraper
https://municode-scraper.your-subdomain.workers.dev
```

### 3. Test Worker (10 seconds)

```bash
# Test connection
curl https://municode-scraper.your-subdomain.workers.dev/list

# Test single scrape
curl -X POST https://municode-scraper.your-subdomain.workers.dev/scrape \
  -H "Content-Type: application/json" \
  -d '{"municipalityId":"birmingham-al"}'
```

### 4. Set Environment Variable (10 seconds)

In Replit Secrets or `.env`:
```
MUNICODE_WORKER_URL=https://municode-scraper.your-subdomain.workers.dev
```

---

## 📡 Worker API

### GET /list
List available municipalities

**Response:**
```json
{
  "municipalities": ["birmingham-al", "montgomery-al", ...],
  "count": 6
}
```

### POST /scrape
Scrape a single municipality

**Request:**
```json
{
  "municipalityId": "birmingham-al"
}
```

**Response:**
```json
{
  "success": true,
  "municipality": "Birmingham",
  "state": "AL",
  "districtsFound": 25,
  "districts": [
    {
      "municipality_id": "birmingham-al",
      "zoning_code": "R-1",
      "district_name": "Single Family Residential",
      "max_density_per_acre": 4,
      "max_height_feet": 35,
      "max_stories": 2
    },
    ...
  ],
  "scrapedAt": "2026-02-23T18:30:00Z"
}
```

---

## 🔧 Backend Usage

### Test Worker Connection

```bash
npm run scrape:worker -- --test
```

Output:
```
Testing worker connection...

✅ Worker is online! Found 6 municipalities:
  - birmingham-al
  - montgomery-al
  - louisville-ky
  - lexington-ky
  - fort-worth-tx
  - el-paso-tx
```

### Scrape Single City

```bash
npm run scrape:worker -- --city=birmingham-al
```

Output:
```
Scraping birmingham-al via worker...

Worker found 25 districts for Birmingham

✅ Success!
  Birmingham, AL
  Districts: 25
  Quality: excellent
```

### Scrape HIGH Priority (6 cities, ~1-2 minutes)

```bash
npm run scrape:worker -- --priority=HIGH
```

Output:
```
Scraping 6 HIGH priority cities...

[1/6] Birmingham, AL... ✅ 25 districts
[2/6] Montgomery, AL... ✅ 18 districts
[3/6] Louisville, KY... ✅ 32 districts
[4/6] Lexington, KY... ✅ 22 districts
[5/6] Fort Worth, TX... ✅ 28 districts
[6/6] El Paso, TX... ✅ 30 districts

📊 Results:
  ✅ Success: 6
  ❌ Failed: 0
```

### Scrape All 26 Cities (~5-10 minutes)

```bash
npm run scrape:worker -- --all
```

---

## 💾 Data Storage

**Scraped data is saved to your database:**

```sql
-- View scraped data
SELECT 
  m.name, 
  m.state, 
  COUNT(zd.id) as districts_found,
  m.last_scraped_at
FROM municipalities m
LEFT JOIN zoning_districts zd ON zd.municipality_id = m.id
WHERE m.has_api = FALSE
GROUP BY m.id, m.name, m.state, m.last_scraped_at
ORDER BY districts_found DESC;
```

---

## 🎯 Integration with Zoning Module

**Add auto-lookup button:**

```typescript
// In ZoningCapacitySection.tsx

const fetchZoning = async () => {
  // 1. Call worker via backend
  const response = await fetch('/api/zoning/lookup', {
    method: 'GET',
    params: {
      address: deal.address,
      city: 'birmingham-al', // Determine from deal
    },
  });
  
  // 2. Auto-fill form
  if (response.ok) {
    const data = await response.json();
    updateField('zoning_code', data.zoning_code);
    updateField('max_density', data.max_density_per_acre);
    updateField('max_height_feet', data.max_height_feet);
    // etc.
  }
};
```

---

## 💰 Cloudflare Workers Pricing

**Free Tier:**
- 100,000 requests/day
- 10ms CPU time/request
- ✅ **Enough for occasional scraping**

**Paid Tier ($5/month):**
- 10 million requests/month
- 50ms CPU time/request
- ✅ **Needed for heavy scraping**

**For 26 cities:**
- ~26 requests (one per city)
- ~FREE if run once/day
- ~$0.00 cost per run

---

## 📊 Performance Comparison

| Method | Time | Cost | CPU |
|--------|------|------|-----|
| **Local Playwright** | 4-6 hours | $0 | High (your server) |
| **Cloudflare Worker** | 1-2 minutes | $0 (free tier) | Low (Cloudflare) |

**Winner:** Cloudflare Worker (200x faster!) 🚀

---

## 🛠️ Advanced: Add More Cities

**Edit `municode-scraper.js`:**

```javascript
const MUNICIPALITIES = {
  // ... existing cities
  
  'new-city-id': {
    name: 'New City',
    state: 'XX',
    municodeUrl: 'https://library.municode.com/xx/new_city/codes/code_of_ordinances',
    zoningChapterPath: '?nodeId=XXXX',
  },
};
```

**Redeploy:**
```bash
cd workers
wrangler deploy
```

---

## 🔍 Troubleshooting

**Worker returns empty districts:**
- Check if Municode URL is correct
- Try accessing URL in browser first
- Some cities may have different HTML structure

**Worker timeout:**
- Worker has 30 second timeout
- If city has 100+ districts, may timeout
- Solution: Upgrade to paid Workers plan (50ms CPU time)

**Database connection error:**
- Check `DATABASE_URL` in backend `.env`
- Make sure migration 048 is run

---

## 📋 Deployment Checklist

- [ ] Install Wrangler CLI
- [ ] Deploy worker to Cloudflare
- [ ] Get worker URL
- [ ] Set `MUNICODE_WORKER_URL` in backend
- [ ] Test worker connection
- [ ] Scrape test city (Birmingham)
- [ ] Scrape all HIGH priority cities
- [ ] Verify data in database

---

**Ready to deploy!** 🚀

Run:
```bash
cd workers
wrangler deploy
```
