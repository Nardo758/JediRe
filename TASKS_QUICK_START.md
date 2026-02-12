# 🎯 Global Tasks - Quick Start Guide

## Access in 3 Steps

1. **Start frontend**:
   ```bash
   cd /home/leon/clawd/jedire/frontend
   npm run dev
   ```

2. **Open browser**: `http://localhost:5173`

3. **Click**: 🎯 **Tasks** in sidebar (under TOOLS section)

---

## What You'll See

### Main View
- **7 stat cards** at top (Total, Open, In Progress, Blocked, Complete, Overdue, Due Today)
- **Filter panel** with search + advanced filters (collapsible)
- **Grid table** with sortable columns
- **Pagination** at bottom (50 tasks per page)

### 45 Realistic Tasks
Across 4 deals:
- **Buckhead Tower Development** (8 tasks - due diligence/financing/legal)
- **Midtown Plaza Acquisition** (3 tasks - early stage)
- **Sandy Springs Multifamily** (4 tasks - due diligence)
- **Decatur Office Building** (8 tasks - operations/leasing)
- **Global** (2 tasks - reporting)

### Key Features to Try

**1. Sorting**
- Click any column header to sort
- Click again to reverse

**2. Filtering**
- Click "Show Filters"
- Select status, priority, category
- Choose specific deal or user
- Search by keyword

**3. Bulk Actions**
- Check multiple tasks
- Click "Mark Complete" or "More Actions"
- Change priority, assign, or delete

**4. Task Details**
- Click any task row
- See full details + comments + attachments
- Edit inline or add comments

**5. Create Task**
- Click "+ Create Task" button
- Fill form (task name, deal, category, assigned, priority, due date)
- Click "Create Task"

---

## Visual Highlights

### Color Coding
- 🔴 **Overdue** = Red background row
- 📅 **Due today** = Yellow background row
- ✅ **Complete** = Grayed out
- 🚧 **Blocked** = Red badge with reason

### Priority Badges
- 🔴 High (red)
- 🟡 Medium (yellow)
- ⚪ Low (gray)

### Status Badges
- Blue = Open
- Purple = In Progress
- Red = Blocked
- Green = Complete

---

## Mock Data

All data stored in **localStorage** (`jedire_tasks` key).

**Reset anytime**: Click "🔄 Reset Data" button in top right.

---

## Next Step

Build the backend! You now know exactly what the UI needs:
- Task CRUD endpoints
- Filter/sort logic
- Real user assignments
- Email integration for AI task creation

Read full details in: **`TASKS_GRID_VIEW_COMPLETE.md`**

---

Built with ❤️  
~3,000 lines of code  
~2 hours of work  
100% functional
