# HEARTBEAT.md

# JediRe Code Quality Monitoring
# Runs automated checks twice per day during heartbeat cycles

## Schedule

### Morning Check (8:00-12:00 local time)
Run quick health checks if we haven't checked in the last 6 hours:

```bash
LAST_CHECK=$(cat /tmp/jedire-last-check 2>/dev/null || echo 0)
CURRENT_TIME=$(date +%s)
TIME_DIFF=$((CURRENT_TIME - LAST_CHECK))

# Run if >6 hours (21600 seconds) since last check
if [ $TIME_DIFF -gt 21600 ]; then
  /home/leon/clawd/monitoring/jedire-checks.sh
  
  # If issues found (exit code > 0), alert me
  if [ $? -gt 0 ]; then
    echo "⚠️ JediRe code quality issues detected. Check /tmp/jedire-check-report.txt"
  fi
  
  # Update last check timestamp
  echo $CURRENT_TIME > /tmp/jedire-last-check
fi
```

### Evening Check (18:00-22:00 local time)  
Run deep analysis once per day:

```bash
LAST_DEEP_CHECK=$(cat /tmp/jedire-last-deep-check 2>/dev/null || echo 0)
CURRENT_TIME=$(date +%s)
TIME_DIFF=$((CURRENT_TIME - LAST_DEEP_CHECK))

# Run if >24 hours since last deep check
if [ $TIME_DIFF -gt 86400 ]; then
  node /home/leon/clawd/monitoring/analyze-code.js
  
  if [ $? -gt 0 ]; then
    echo "🔍 JediRe deep analysis found critical issues. Review memory/jedire-monitoring.json"
  fi
  
  echo $CURRENT_TIME > /tmp/jedire-last-deep-check
fi
```

## What Gets Checked

**Fast checks (jedire-checks.sh):**
- TypeScript compilation errors
- npm security vulnerabilities
- Large file changes
- Bundle size monitoring
- Slow database queries

**Deep analysis (analyze-code.js):**
- Unused imports/exports
- Duplicate code detection
- Bundle size breakdown
- API performance patterns
- Historical trend tracking

## Alert Conditions

I'll notify you when:
- ❌ TypeScript compilation fails
- 🔒 High/critical security vulnerabilities found
- 📦 Bundle size exceeds 10MB
- 🐌 Slow queries detected (>100ms)
- 📈 Negative trends (bundle growing, issues increasing)

## Notes

- Checks are time-gated to avoid excessive runs
- Fast check completes in <30s to not slow heartbeats
- Deep analysis runs once daily during evening hours
- Results saved to memory/jedire-monitoring.json for trend tracking
- HEARTBEAT_OK returned if no checks needed or all passed
