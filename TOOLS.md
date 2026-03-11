# TOOLS.md - Local Notes

Skills define *how* tools work. This file is for *your* specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:
- Camera names and locations
- SSH hosts and aliases  
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## JediRe Platform Access

**API Base URL:**
```
https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev
```

**Authentication:**
```bash
Authorization: Bearer 69295404e382acd00de4facdaa053fd20ae0a1cf15dc63c0b8a55cffc0e088b6
```

**Available Endpoints:**

1. **Health Check:**
   ```bash
   GET /api/v1/clawdbot/health
   ```

2. **Commands:**
   ```bash
   POST /api/v1/clawdbot/command
   Body: {"command": "<command_name>", "params": { ... }}
   ```

3. **Queries:**
   ```bash
   POST /api/v1/clawdbot/query
   Body: {"query": "status|deals_count|recent_errors"}
   ```

**Commands Reference:**

| Command | Params | Example |
|---------|--------|---------|
| `get_deals` | _(none)_ | `{"command": "get_deals"}` |
| `get_deal` | `{"dealId": "..."}` | `{"command": "get_deal", "params": {"dealId": "e044db04-..."}}` |
| `run_analysis` | `{"dealId": "..."}` | `{"command": "run_analysis", "params": {"dealId": "e044db04-..."}}` |
| `system_stats` | _(none)_ | `{"command": "system_stats"}` |
| `recent_errors` | _(none)_ | `{"command": "recent_errors"}` |

**Example Usage:**
```bash
curl -X POST https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/clawdbot/command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 69295404e382acd00de4facdaa053fd20ae0a1cf15dc63c0b8a55cffc0e088b6" \
  -d '{"command": "get_deal", "params": {"dealId": "e044db04-439b-4442-82df-b36a840f2fd8"}}'
```

**Key Deals:**
- **Atlanta Development** (300 units): `e044db04-439b-4442-82df-b36a840f2fd8`
  - Address: 1950 Piedmont Circle NE, Atlanta, GA 30324
  - Multifamily with parking structure
  - 3D design requirements documented in: `/home/leon/clawd/jedire-3d-design-requirements.md`

---

## Examples

```markdown
### Cameras
- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH
- home-server → 192.168.1.100, user: admin

### TTS
- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
