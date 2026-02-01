# 🚀 RocketMan Gateway Dashboard

Your personal control center for monitoring and managing RocketMan (Clawdbot).

## Features

### 📊 Overview Tab
- **Real-time System Stats** - Uptime, active sessions, model info, token usage
- **Quick Actions** - Fast access to all dashboard features
- **Activity Feed** - Recent tasks and completions
- **Sub-Agent Monitor** - Track spawned tasks
- **Project Status** - Overview of your active projects

### 📜 Live Logs Tab
- **Real-time Log Streaming** - Watch system logs as they happen
- **Auto-scroll** - Automatically follow latest logs
- **Log Filtering** - Filter by type (success, error, warning)
- **Log Management** - Refresh and clear logs

### ⚡ Task Spawner Tab
- **Spawn Sub-Agents** - Create new background tasks
- **Task Management** - Monitor active and completed tasks
- **Custom Configuration** - Set timeouts, agents, labels
- **Task Templates** - Quick-start common operations

### 🧠 Memory Browser Tab
- **File Navigation** - Browse all memory files
- **Search Functionality** - Find content across memory
- **File Viewer** - Read memory files directly
- **Quick Access** - Jump to AGENTS.md, SOUL.md, USER.md, etc.

## How to Use

### Option 1: Open Directly
Just double-click `index.html` in your file browser.

### Option 2: Local Server (Better)
```bash
cd /home/leon/clawd/rocketman-dashboard
python3 -m http.server 8080
```
Then open: http://localhost:8080

### Option 3: Pin to Desktop
Create a desktop shortcut to `index.html` for instant access.

## Future Enhancements

- Live API integration with gateway
- Real-time session monitoring
- Task spawning from dashboard
- Memory browser
- Log viewer
- Cost/usage analytics

---

Built for Leon by RocketMan 🚀
