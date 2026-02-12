# 📚 Project Management System - User Guide

Welcome to your new project management system! This guide shows you how to use it.

---

## 🗂️ System Overview

Your project management system consists of 4 key files:

1. **`PROJECT_TRACKER.md`** - Central dashboard, portfolio overview
2. **`SPRINT.md`** - Current week's sprint planning and tasks
3. **`HEARTBEAT.md`** - Automated check-in configuration
4. **`memory/YYYY-MM-DD.md`** - Daily work log

---

## 📖 How to Use

### 📊 Check Project Status

**View the dashboard:**
```bash
cat PROJECT_TRACKER.md
```

**What you'll see:**
- Portfolio overview (all projects)
- Current sprint focus
- Progress metrics
- Active blockers
- Upcoming milestones

**When to check:** Anytime you want a big-picture view

---

### 🏃 Check Current Sprint

**View this week's sprint:**
```bash
cat SPRINT.md
```

**What you'll see:**
- Sprint goals
- Task breakdown with estimates
- Daily plan
- Blockers
- Success metrics

**When to check:** Daily, to see what's planned

---

### ✅ Mark Tasks Complete

**Manual update:**
Edit `SPRINT.md` and change:
```markdown
- [ ] Task name
```
to:
```markdown
- [x] ✅ Task name
```

**Or just tell me:** "Mark X task as done" and I'll update it.

---

### 📝 Log Important Work

**Everything gets logged automatically to:**
```
memory/YYYY-MM-DD.md
```

**You can also:**
- Tell me: "Log this decision: [description]" → I'll add to Decision Log
- Tell me: "Update progress on JEDI RE" → I'll update PROJECT_TRACKER.md

---

### 🚧 Report a Blocker

**Tell me:** "JEDI RE is blocked because [reason]"

**I'll:**
1. Add to `PROJECT_TRACKER.md` Blockers section
2. Mark relevant sprint tasks as blocked
3. Update status to show impact

**Check blockers:**
```bash
grep -A 5 "Current Blockers" PROJECT_TRACKER.md
```

---

### 🎯 Set New Goals

**Tell me:** "Add goal: [description] for [project]"

**Or edit directly:**
- `SPRINT.md` for this week's goals
- `PROJECT_TRACKER.md` for milestone goals

---

## 🤖 Automated Features

### Heartbeat Updates (2-4x per day)

**I automatically:**
- Check project progress
- Update completion %
- Flag blockers
- Log work to memory files
- Update PROJECT_TRACKER.md if significant progress

**You'll see updates in:**
- `PROJECT_TRACKER.md` (portfolio metrics)
- `memory/YYYY-MM-DD.md` (detailed log)

### Weekly Sprint Review (Sundays)

**I automatically:**
1. Calculate sprint completion %
2. Move incomplete tasks to next sprint
3. Create next week's `SPRINT.md`
4. Update milestone tracking
5. Generate progress report

**You'll be notified:** Sunday evenings with sprint summary

---

## 📋 Common Tasks

### Start a New Project

**Tell me:** "Add new project: [name]"

**I'll:**
1. Add to `PROJECT_TRACKER.md`
2. Create project directory
3. Set up initial tracking files

### View All Projects

```bash
grep -A 1 "^| \*\*" PROJECT_TRACKER.md | head -20
```

Shows portfolio table with all projects.

### Check This Week's Focus

```bash
head -50 SPRINT.md
```

Shows sprint goals and priorities.

### See What's Blocked

```bash
grep -B 2 -A 5 "BLOCKED" SPRINT.md
```

Lists all blocked tasks.

### Review Last Week's Work

```bash
cat memory/$(date -d "last monday" +%Y-%m-%d).md
```

Shows last week's daily log.

---

## 🎨 Customization

### Change Sprint Length

**Default:** Weekly (Monday-Sunday)

**To change:**
Edit `SPRINT.md` dates manually, or tell me: "Make sprints 2 weeks long"

### Add Custom Sections

**You can add to any file:**
- PROJECT_TRACKER.md → Add project-specific sections
- SPRINT.md → Add custom tracking metrics
- HEARTBEAT.md → Customize check frequency

### Change Heartbeat Frequency

**Default:** 2-4x per day

**To change:**
Edit `HEARTBEAT.md` and tell me the new schedule.

---

## 🔍 Queries You Can Ask Me

### Project Status
- "What's the status of JEDI RE?"
- "Show me Apartment Locator AI progress"
- "What's blocking right now?"

### Sprint Planning
- "What's left this sprint?"
- "Are we on track for this week?"
- "What should I work on next?"

### History
- "What did we accomplish yesterday?"
- "Show me last week's progress"
- "When did we complete Phase 1?"

### Planning
- "Plan next sprint"
- "Add task to sprint"
- "Move this task to next week"

---

## 📊 Reports Available

### Daily Progress Report
Ask me: "Show today's progress"

**Shows:**
- Tasks completed today
- Blockers hit
- Time spent per project
- Notes/decisions

### Weekly Sprint Report
Automatic every Sunday

**Shows:**
- Sprint completion %
- Tasks done vs planned
- Blockers encountered
- Next week's plan

### Monthly Portfolio Report
Ask me: "Generate monthly report"

**Shows:**
- All projects status
- Milestones hit
- Progress trends
- Strategic overview

---

## 💡 Pro Tips

### 1. Start Each Day
Ask me: "What should I work on today?"

I'll check SPRINT.md and prioritize based on blockers and deadlines.

### 2. End Each Day
Tell me: "Log today's work"

I'll summarize to memory and update trackers.

### 3. Weekly Planning
Tell me: "Plan next week" on Sunday

I'll create the next sprint with carried-over tasks and new priorities.

### 4. Stay Unblocked
Tell me immediately when blocked: "Can't proceed because [reason]"

I'll document and suggest solutions or workarounds.

### 5. Celebrate Wins
Tell me: "We shipped [feature]!"

I'll update trackers and log the milestone.

---

## 🆘 Troubleshooting

### "I don't see my project in PROJECT_TRACKER.md"
Tell me: "Add [project name] to tracker"

### "SPRINT.md is out of date"
Tell me: "Refresh sprint file"

### "I want to reset tracking"
Tell me: "Archive current tracker and start fresh"

### "Too many heartbeat notifications"
Tell me: "Reduce heartbeat frequency" or edit HEARTBEAT.md

### "Not enough updates"
Tell me: "Increase heartbeat checks" or edit HEARTBEAT.md

---

## 🎯 Quick Reference Card

| I want to... | Command/Action |
|--------------|----------------|
| See all projects | `cat PROJECT_TRACKER.md` |
| See this week's tasks | `cat SPRINT.md` |
| Mark task done | Tell me or edit SPRINT.md |
| Report blocker | Tell me: "X is blocked" |
| Check what's blocked | `grep BLOCKED SPRINT.md` |
| See today's work | `cat memory/$(date +%Y-%m-%d).md` |
| Plan next week | Tell me: "Plan next sprint" |
| Add new project | Tell me: "Add project: [name]" |
| Get progress report | Tell me: "Show progress" |
| Update milestone | Tell me: "Update milestone" |

---

## 🚀 Getting Started Checklist

- [x] ✅ PROJECT_TRACKER.md created
- [x] ✅ SPRINT.md for current week created
- [x] ✅ HEARTBEAT.md configured
- [x] ✅ Integration with memory files
- [ ] Review PROJECT_TRACKER.md
- [ ] Review SPRINT.md
- [ ] Customize HEARTBEAT.md if needed
- [ ] Start using the system!

---

## 📞 Need Help?

Just ask me:
- "How do I [task] in the project tracker?"
- "Show me an example of [feature]"
- "Explain the [section] in PROJECT_TRACKER.md"

I'm here to help you stay organized! 🚀

---

**System Version:** 1.0  
**Created:** 2026-02-03  
**Last Updated:** 2026-02-03
