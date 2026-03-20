# DevOps Agent Heartbeat

Run the monitoring orchestrator script:

```bash
/home/leon/clawd/jedire-agents/ops-agent/monitor.sh
```

**This script handles:**
- Time-gated checks (morning/evening)
- Execution of monitoring scripts
- Issue detection and alerting
- Timestamp management

**Expected outputs:**
- `HEARTBEAT_OK` - Nothing to do right now
- Success message - Checks passed
- Warning message - Issues found (alert Leon)
- Critical message - Urgent issues (immediate alert)

**Do not run checks manually** - let the orchestrator handle timing and execution.

If the script outputs anything other than `HEARTBEAT_OK`, alert Leon via the message tool with the full output.
