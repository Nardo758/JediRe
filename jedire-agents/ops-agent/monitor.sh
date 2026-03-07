#!/bin/bash
# JediRe Platform Monitoring Orchestrator
# Called by DevOps agent during heartbeats

set -e

# Paths
MONITORING_DIR="/home/leon/clawd/monitoring"
CHECKS_SCRIPT="$MONITORING_DIR/jedire-checks.sh"
ANALYSIS_SCRIPT="$MONITORING_DIR/analyze-code.js"
LAST_CHECK_FILE="/tmp/jedire-last-check"
LAST_DEEP_CHECK_FILE="/tmp/jedire-last-deep-check"
REPORT_FILE="/tmp/jedire-check-report.txt"
MEMORY_FILE="/home/leon/clawd/memory/jedire-monitoring.json"

# Time tracking
CURRENT_TIME=$(date +%s)
CURRENT_HOUR=$(date +%H)

# Read last check timestamps
LAST_CHECK=$(cat "$LAST_CHECK_FILE" 2>/dev/null || echo 0)
LAST_DEEP_CHECK=$(cat "$LAST_DEEP_CHECK_FILE" 2>/dev/null || echo 0)

# Calculate time differences (in seconds)
TIME_SINCE_CHECK=$((CURRENT_TIME - LAST_CHECK))
TIME_SINCE_DEEP_CHECK=$((CURRENT_TIME - LAST_DEEP_CHECK))

# Thresholds
SIX_HOURS=21600
TWENTY_FOUR_HOURS=86400

# Results
RAN_CHECKS=false
RAN_DEEP=false
ISSUES_FOUND=false
CRITICAL_ISSUES=false

# Morning check (8:00-12:00, if >6 hours since last)
if [ "$CURRENT_HOUR" -ge 8 ] && [ "$CURRENT_HOUR" -lt 12 ] && [ "$TIME_SINCE_CHECK" -gt "$SIX_HOURS" ]; then
  echo "🔍 Running morning health check..."
  
  if [ -x "$CHECKS_SCRIPT" ]; then
    if $CHECKS_SCRIPT > "$REPORT_FILE" 2>&1; then
      echo "✅ All checks passed"
    else
      echo "⚠️ Issues detected"
      ISSUES_FOUND=true
      
      # Check for critical issues
      if grep -q "TypeScript compilation failed\|CRITICAL\|HIGH" "$REPORT_FILE"; then
        CRITICAL_ISSUES=true
      fi
    fi
    
    echo "$CURRENT_TIME" > "$LAST_CHECK_FILE"
    RAN_CHECKS=true
  else
    echo "❌ Checks script not found or not executable: $CHECKS_SCRIPT"
  fi
fi

# Evening check (18:00-22:00, if >24 hours since last)
if [ "$CURRENT_HOUR" -ge 18 ] && [ "$CURRENT_HOUR" -lt 22 ] && [ "$TIME_SINCE_DEEP_CHECK" -gt "$TWENTY_FOUR_HOURS" ]; then
  echo "🔍 Running evening deep analysis..."
  
  if [ -x "$ANALYSIS_SCRIPT" ]; then
    if node "$ANALYSIS_SCRIPT" 2>&1 | tee -a "$REPORT_FILE"; then
      echo "✅ Deep analysis complete"
    else
      echo "⚠️ Deep analysis found issues"
      ISSUES_FOUND=true
    fi
    
    echo "$CURRENT_TIME" > "$LAST_DEEP_CHECK_FILE"
    RAN_DEEP=true
  else
    echo "❌ Analysis script not found or not executable: $ANALYSIS_SCRIPT"
  fi
fi

# Generate output for agent
if [ "$RAN_CHECKS" = false ] && [ "$RAN_DEEP" = false ]; then
  echo "HEARTBEAT_OK"
  exit 0
fi

# Report issues if found
if [ "$ISSUES_FOUND" = true ]; then
  echo ""
  echo "📋 Issue Summary:"
  echo "─────────────────"
  
  if [ -f "$REPORT_FILE" ]; then
    cat "$REPORT_FILE"
  fi
  
  if [ "$CRITICAL_ISSUES" = true ]; then
    echo ""
    echo "🚨 CRITICAL ISSUES DETECTED - IMMEDIATE ATTENTION REQUIRED"
    exit 2
  else
    echo ""
    echo "⚠️ Non-critical issues detected - review when convenient"
    exit 1
  fi
fi

# Success
echo ""
echo "✅ All monitoring checks passed"
echo "Last check: $(date -d @$LAST_CHECK)"
echo "Last deep check: $(date -d @$LAST_DEEP_CHECK)"
exit 0
