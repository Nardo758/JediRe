# JediRe Monitoring - Quick Reference Card

## 🚀 Quick Commands

```bash
# Run fast health check
/home/leon/clawd/monitoring/jedire-checks.sh

# Run deep analysis
node /home/leon/clawd/monitoring/analyze-code.js

# View latest quick check results
cat /tmp/jedire-check-report.txt

# View historical trends
cat /home/leon/clawd/memory/jedire-monitoring.json

# Check when last run
ls -lh /tmp/jedire-last-check /tmp/jedire-last-deep-check
```

## 📊 What Gets Checked

| Check | Tool | Frequency | Runtime |
|-------|------|-----------|---------|
| TypeScript errors | `tsc --noEmit` | 2x/day | ~5s |
| Security vulnerabilities | `npm audit` | 2x/day | ~10s |
| Large file changes | `git diff` | 2x/day | ~2s |
| Bundle size | `du -sh` | 2x/day | ~3s |
| Slow queries | `psql` | 2x/day | ~5s |
| Unused imports | Custom analysis | 1x/day | ~15s |
| Duplicate code | Custom analysis | 1x/day | ~20s |
| API patterns | Custom analysis | 1x/day | ~10s |

## 🔔 Alert Triggers

| Severity | Condition | Action |
|----------|-----------|--------|
| 🔴 Critical | TypeScript compilation fails | Fix immediately |
| 🔴 Critical | High/Critical CVEs found | Update dependencies |
| 🟡 Warning | Bundle size >10MB | Optimize assets |
| 🟡 Warning | >10 API inefficiencies | Review queries |
| 🟡 Warning | Slow queries (>100ms) | Add indexes |
| 🟢 Info | Unused imports detected | Cleanup recommended |

## 📁 File Locations

```
/home/leon/clawd/
├── HEARTBEAT.md                    → Integration config
├── monitoring/
│   ├── jedire-checks.sh           → Fast checks (exec)
│   ├── analyze-code.js            → Deep analysis (exec)
│   ├── README.md                  → Full documentation
│   ├── QUICK_REFERENCE.md         → This file
│   └── SETUP_COMPLETE.md          → Setup summary
└── memory/
    └── jedire-monitoring.json     → Trend data

/tmp/
├── jedire-check-report.txt        → Latest quick check results
├── jedire-last-check              → Timestamp: last quick check
└── jedire-last-deep-check         → Timestamp: last deep analysis
```

## ⏰ Heartbeat Schedule

- **6:00-12:00** → Quick check if >6hrs since last
- **18:00-22:00** → Deep analysis if >24hrs since last
- Automatic via HEARTBEAT.md integration
- Results appear in heartbeat response

## 🔧 Common Tasks

### Force a Check (Ignore Timing)
```bash
# Quick check
rm /tmp/jedire-last-check
./monitoring/jedire-checks.sh

# Deep analysis
rm /tmp/jedire-last-deep-check
node monitoring/analyze-code.js
```

### View Trends
```bash
cat memory/jedire-monitoring.json | jq '.trends'
```

### Reset Monitoring History
```bash
echo '{"lastRun":null,"analysis":null,"trends":[]}' > memory/jedire-monitoring.json
```

### Add Custom Check
Edit `monitoring/jedire-checks.sh` and add:
```bash
echo -e "${YELLOW}Checking [NAME]...${NC}"
if [ CONDITION ]; then
    echo "[WARN] Issue" >> "$REPORT_FILE"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo "[PASS] OK" >> "$REPORT_FILE"
fi
```

## 🎯 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed ✅ |
| 1-10 | Issues found (count) ⚠️ |
| >10 | Critical issues 🔴 |

## 💡 Pro Tips

1. **Pipe output to less** for easier reading:
   ```bash
   ./monitoring/jedire-checks.sh | less -R
   ```

2. **Watch trends** to catch degradation early:
   ```bash
   watch -n 3600 'cat memory/jedire-monitoring.json | jq .trends'
   ```

3. **Combine with git** for commit hooks:
   ```bash
   # In .git/hooks/pre-commit
   /home/leon/clawd/monitoring/jedire-checks.sh || exit 1
   ```

4. **JSON output** from deep analysis:
   ```bash
   node monitoring/analyze-code.js
   cat memory/jedire-monitoring.json | jq .
   ```

## 🚨 Troubleshooting

**Problem:** "No such file or directory: jedire"  
**Solution:** Export correct path:
```bash
export JEDIRE_DIR=/home/leon/clawd/jedire
```

**Problem:** "tsc: command not found"  
**Solution:** Install TypeScript:
```bash
cd /home/leon/clawd/jedire && npm install -D typescript
```

**Problem:** Checks run too frequently  
**Solution:** Increase time thresholds in HEARTBEAT.md

**Problem:** Need more verbose output  
**Solution:** Add `set -x` to top of jedire-checks.sh

## 📈 Metrics Explained

- **Bundle Size:** Total bytes of production frontend build
- **Large Files:** Individual assets >500KB
- **Unused Imports:** Imported but never referenced in file
- **Duplicate Code:** 5+ line blocks appearing multiple times
- **API Inefficiencies:** SELECT * or unbounded queries
- **Slow Queries:** Database operations taking >100ms

---

**Last Updated:** 2024-03-02  
**Version:** 1.0  
**Total Lines of Code:** 911
