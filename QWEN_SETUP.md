# Qwen AI Setup Guide

Step-by-step guide to configure Qwen AI in JEDI RE.

---

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- Access to HuggingFace (free account)

---

## Step 1: Get HuggingFace Token

1. **Create HuggingFace account** (if you don't have one):
   - Visit [https://huggingface.co/join](https://huggingface.co/join)
   - Sign up with email

2. **Generate Access Token:**
   - Go to [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
   - Click "New token"
   - Name: `jedire-ai`
   - Type: `Read`
   - Click "Generate"
   - **Copy the token immediately** (you won't see it again)

---

## Step 2: Configure Environment Variables

### Backend Configuration

1. Open `/home/leon/clawd/jedire/.env` (create if doesn't exist)

2. Add Qwen configuration:

```bash
# Qwen AI Configuration
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
QWEN_MODEL=Qwen/Qwen3.5-397B-A17B:novita
QWEN_BASE_URL=https://router.huggingface.co/v1

# Optional: Mapbox for satellite imagery
MAPBOX_TOKEN=your_mapbox_token_here
```

3. Replace `hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` with your actual token

---

## Step 3: Install Dependencies

### Backend

```bash
cd /home/leon/clawd/jedire/backend
npm install openai
npm install multer @types/multer
```

### Frontend

```bash
cd /home/leon/clawd/jedire/frontend
npm install zustand
```

---

## Step 4: Restart Services

### Development

```bash
# Terminal 1: Backend
cd /home/leon/clawd/jedire/backend
npm run dev

# Terminal 2: Frontend
cd /home/leon/clawd/jedire/frontend
npm run dev
```

### Production

```bash
# Using PM2
pm2 restart jedire-backend
pm2 restart jedire-frontend

# Or Docker
docker-compose restart
```

---

## Step 5: Verify Installation

### Method 1: API Test

```bash
curl http://localhost:4000/api/v1/ai/status
```

**Expected Response:**
```json
{
  "enabled": true,
  "message": "Qwen AI service is available",
  "model": "Qwen/Qwen3.5-397B-A17B:novita"
}
```

### Method 2: Frontend Test

1. Open browser: `http://localhost:5173`
2. Navigate to any deal
3. Open 3D Viewport
4. Upload a site photo
5. Check if AI terrain analysis triggers

---

## Step 6: Configure Optional Features

### Satellite Imagery (for Aerial Analysis)

1. Get Mapbox token:
   - Visit [https://account.mapbox.com/](https://account.mapbox.com/)
   - Create free account
   - Copy default public token

2. Add to `.env`:
```bash
MAPBOX_TOKEN=pk.eyJ1Ijoi...
```

### AI Feature Toggles

Edit `frontend/src/stores/settings.store.ts` defaults:

```typescript
const defaultAISettings: AISettings = {
  enabled: true,
  features: {
    imageTo3D: true,          // Enable/disable
    designCompliance: true,
    aerialAnalysis: true,
    ownerDisposition: true,
    autoTagPhotos: true,
    progressEstimation: true,
    rentPrediction: false,     // Disabled (not implemented yet)
    costEstimation: false,     // Disabled (not implemented yet)
  },
};
```

---

## Troubleshooting

### Issue: "AI service not available"

**Symptoms:**
- API returns `enabled: false`
- `/api/v1/ai/status` shows message about HF_TOKEN

**Solution:**
1. Verify `HF_TOKEN` is in `.env`
2. Ensure no typos in token
3. Restart backend: `npm run dev` or `pm2 restart jedire-backend`
4. Check logs: `tail -f backend/logs/error.log`

---

### Issue: "401 Unauthorized" from HuggingFace

**Symptoms:**
- AI calls fail with HF API errors
- Logs show "401 Unauthorized"

**Solution:**
1. Verify token is valid (hasn't been deleted)
2. Generate new token if needed
3. Update `.env` with new token
4. Restart backend

---

### Issue: Slow AI Responses

**Symptoms:**
- AI calls take >10 seconds
- Timeouts

**Solutions:**
1. Resize images before upload (max 1280x1280)
2. Check HuggingFace status: [https://status.huggingface.co/](https://status.huggingface.co/)
3. Implement caching (see Advanced Configuration)
4. Consider using fallback algorithms

---

## Advanced Configuration

### Caching Layer (Redis)

1. Install Redis:
```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis
```

2. Add to `.env`:
```bash
REDIS_URL=redis://localhost:6379
AI_CACHE_TTL=86400  # 24 hours
```

3. Update `qwen.service.ts` to check cache before API call

---

### Custom Model Selection

To use a different Qwen model:

```bash
# .env
QWEN_MODEL=Qwen/Qwen3.5-110B:free  # Smaller, faster model
# or
QWEN_MODEL=Qwen/Qwen3.5-397B-A17B:base  # Different endpoint
```

---

### Rate Limiting Configuration

Adjust API rate limits in `backend/src/server.ts`:

```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Max 100 requests per 15 min
});

app.use('/api/v1/ai', limiter);
```

---

## Production Deployment

### Environment Variables

Ensure these are set in production:

```bash
NODE_ENV=production
HF_TOKEN=<production_token>
QWEN_MODEL=Qwen/Qwen3.5-397B-A17B:novita
QWEN_BASE_URL=https://router.huggingface.co/v1
```

### Monitoring

Add logging and monitoring:

```bash
# Enable debug logs
LOG_LEVEL=debug

# Monitor AI usage
tail -f backend/logs/qwen-service.log
```

### Backup Strategy

If HuggingFace is down:
1. All endpoints gracefully fallback to rule-based algorithms
2. User experience degraded but functional
3. Monitor uptime: [https://status.huggingface.co/](https://status.huggingface.co/)

---

## Cost Management

### Free Tier Limits

HuggingFace free tier:
- Limited daily requests (varies by model)
- Slower inference speeds
- Subject to rate limiting

### Paid Plans

To upgrade:
1. Visit [https://huggingface.co/pricing](https://huggingface.co/pricing)
2. Choose appropriate plan
3. Update billing info
4. Same token works for paid tier

### Monitoring Usage

Track API calls:
```bash
grep "QwenService" backend/logs/*.log | wc -l
```

---

## Security Best Practices

1. **Never commit `.env` to git**
   - Add to `.gitignore`
   - Use `.env.example` for templates

2. **Rotate tokens regularly**
   - Generate new HF token every 90 days
   - Update production secrets

3. **Restrict token permissions**
   - Use "Read" only tokens
   - Don't grant "Write" access

4. **Monitor usage**
   - Set up alerts for unusual activity
   - Review API logs weekly

---

## Next Steps

After setup:

1. ✅ Test all AI endpoints (see `QWEN_API_REFERENCE.md`)
2. ✅ Read user guide (`AI_FEATURE_USAGE.md`)
3. ✅ Configure AI feature toggles in settings
4. ✅ Train team on AI features
5. ⚠️ Monitor usage and costs
6. ⚠️ Implement caching for production

---

## Support

If you encounter issues:

1. Check logs: `backend/logs/error.log`
2. Verify environment: `cat .env | grep HF_TOKEN`
3. Test status endpoint: `curl http://localhost:4000/api/v1/ai/status`
4. Review `QWEN_INTEGRATION_GUIDE.md` troubleshooting section

---

**Setup Complete!** 🎉

Your Qwen AI integration is ready to use. All 5 modules now have AI-enhanced capabilities.

---

**Last Updated:** 2025-02-21
