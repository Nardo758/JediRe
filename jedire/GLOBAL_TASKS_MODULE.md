# Global Tasks Module

**Module Location:** TOOLS → Tasks (Sidebar)  
**Integrated With:** Email Agent, Deal Context Tracker, Calendar  
**Status:** Core Feature (Part of Email Intelligence integration)

---

## Executive Summary

**The Connective Tissue:** Global Tasks Module is the operational layer that connects Email Agent intelligence to actual deal/property execution.

**Key Insight:** Tasks flow bidirectionally:
- **Email → Tasks:** AI detects action items, creates tasks automatically
- **Tasks → Deals/Properties:** Every task routes to Pipeline (pre-acquisition) or Assets Owned (post-acquisition)
- **Tasks → Activity:** All task activity feeds into Deal Context Tracker

**Result:** Nothing falls through the cracks. Every email-generated action item becomes a tracked task linked to the right deal or property.

---

## 1. Task Creation Triggers

### 1.1 Manual Creation
**User Action:** "Create task from this email"

**UI:**
```
[Email thread open, user right-clicks]

┌──────────────────────────────────────────────────────┐
│  📧 Create Task from Email                           │
├──────────────────────────────────────────────────────┤
│  Task Name: [_____________________________]          │
│  Category: [Due Diligence ▼]                         │
│  Link to: [Buckhead Tower Development ▼]             │
│  Assigned to: [Leon D ▼]                             │
│  Due Date: [Feb 15, 2026 ▼]                         │
│  Priority: [🔴 High] [🟡 Medium] [⚪ Low]            │
│  ───────────────────────────────────────────────    │
│  [Cancel] [Create Task]                              │
└──────────────────────────────────────────────────────┘
```

---

### 1.2 AI Detection (Action Items)
**Trigger:** Email body contains action language

**Examples:**
- "Please send us the Phase I by Friday" → **Task:** "Submit Phase I Environmental" (Due: Friday)
- "Can you provide updated rent roll?" → **Task:** "Send Updated Rent Roll to [Broker]"
- "Schedule property tour next week" → **Task:** "Schedule Property Tour" + Calendar event

**AI Detection Algorithm:**
```
Scan email for:
- Action verbs: send, provide, submit, schedule, review, complete
- Deadlines: "by Friday", "before closing", "within 48 hours"
- Documents: Phase I, rent roll, T-12, OM, PSA
- Parties: broker, lender, attorney, inspector
```

**UI (Auto-Generated Task):**
```
┌──────────────────────────────────────────────────────┐
│  🤖 Task Detected from Email                         │
├──────────────────────────────────────────────────────┤
│  "Please send us the Phase I by Friday"              │
│  ───────────────────────────────────────────────    │
│  Suggested Task:                                     │
│  Task: Submit Phase I Environmental                  │
│  Linked to: Buckhead Tower Development               │
│  Due: Friday, Feb 15                                 │
│  Assigned to: Leon D                                 │
│  Category: Due Diligence                             │
│  ───────────────────────────────────────────────    │
│  [Create Task] [Edit First] [Dismiss]               │
└──────────────────────────────────────────────────────┘
```

---

### 1.3 Deadline Detection
**Trigger:** Email mentions milestone or deadline

**Examples:**
- "Inspection period ends March 15" → **Task:** "Complete Inspection" (Due: March 15)
- "PSA expires in 72 hours" → **Task:** "Execute PSA" (Due: +72 hours)
- "Closing scheduled for April 1" → **Task:** "Prepare Closing Docs" (Due: March 25) + Calendar event

**Auto-Creates:**
- Task with deadline
- Calendar event
- Reminder notification (1 day before)

---

### 1.4 Follow-Up Detection
**Trigger:** Unanswered email past threshold

**Thresholds (Configurable per Category):**
- LOI: 48 hours
- Due Diligence: 5 days
- General Inquiry: 7 days
- Investor Relations: 3 days

**Auto-Generated Follow-Up Task:**
```
┌──────────────────────────────────────────────────────┐
│  🔔 Follow-Up Task Created                           │
├──────────────────────────────────────────────────────┤
│  No response from John Smith (Broker)                │
│  on Buckhead Tower LOI                               │
│  ───────────────────────────────────────────────    │
│  Original Email: Jan 22, 2026                        │
│  Days Since: 5 days (threshold: 48 hours)           │
│  ───────────────────────────────────────────────    │
│  Task: Follow up on LOI submission                   │
│  Linked to: Buckhead Tower Development               │
│  Priority: 🔴 High                                   │
│  ───────────────────────────────────────────────    │
│  [Draft Follow-Up Email] [Mark as Done]              │
└──────────────────────────────────────────────────────┘
```

---

### 1.5 Document Request Detection
**Trigger:** Email asks for specific document

**Examples:**
- "Can you send over the T-12?" → **Task:** "Send T-12 to [Contact]"
- "Need updated rent roll ASAP" → **Task:** "Send Updated Rent Roll" (Priority: High)
- "Lender requesting appraisal" → **Task:** "Order Appraisal"

**AI matches document to:**
- Document Vault (check if we have it)
- Contact (who's requesting)
- Deal (which property)

---

### 1.6 Agent-to-Agent Triggers
**Trigger:** Another agent surfaces actionable intelligence

**Examples:**

**Supply Agent → Task:**
```
Supply Agent detects: 200 new units permitted in Midtown
    ↓
Task created: "Review supply impact on Midtown Towers rent projections"
Linked to: Midtown Towers (Assets Owned)
Assigned to: Leon D
Priority: 🟡 Medium
```

**Market Intelligence Agent → Task:**
```
News Agent detects: Interest rates increased 50 bps
    ↓
Task created: "Review refinancing options for all variable-rate loans"
Linked to: Global (affects all Assets Owned)
Priority: 🔴 High
```

**Deal Tracker Agent → Task:**
```
Deal Tracker detects: LOI accepted, entering Due Diligence
    ↓
Tasks created automatically:
- Order Phase I Environmental
- Schedule property inspection
- Submit loan application
- Request updated rent roll
- Engage attorney for PSA review
```

---

## 2. Task Properties

**Every Task Has:**

```typescript
interface Task {
  id: string;
  name: string;
  description?: string;
  
  // Routing
  linkedEntity: {
    type: 'pipeline-deal' | 'assets-owned-property' | 'global';
    id: string;
    name: string;
  };
  
  // Categorization
  category: 'due-diligence' | 'financing' | 'legal' | 'leasing' | 
            'construction' | 'investor-relations' | 'operations';
  
  // Assignment
  assignedTo: {
    userId: string;
    name: string;
    type: 'user' | 'team-member' | 'external-contact';
  };
  
  // Priority (Auto-Scored)
  priority: 'high' | 'medium' | 'low';
  priorityScore: number; // Based on deal stage + deadline proximity
  
  // Timing
  createdAt: Date;
  dueDate?: Date;
  completedAt?: Date;
  
  // Source
  source: {
    type: 'email' | 'agent-alert' | 'manual';
    referenceId?: string; // Email thread ID, alert ID, etc.
    sourceUrl?: string; // Link back to email/alert
  };
  
  // Status
  status: 'open' | 'in-progress' | 'blocked' | 'complete';
  blockedReason?: string;
  
  // Dependencies
  dependencies: string[]; // Task IDs that must complete first
  blocksTaskIds: string[]; // Tasks that depend on this one
  
  // Activity
  comments: Comment[];
  attachments: Attachment[];
}
```

---

## 3. Task Routing Logic

**How Tasks Know Where to Go:**

```typescript
function routeTask(email: Email, taskData: TaskData): TaskRouting {
  // 1. Check for property address match
  if (email.extractedData.propertyAddress) {
    const property = findProperty(email.extractedData.propertyAddress);
    if (property) {
      return {
        type: property.status === 'owned' ? 'assets-owned-property' : 'pipeline-deal',
        id: property.id,
        name: property.name
      };
    }
  }
  
  // 2. Check for deal name match
  if (email.subject.includes('Buckhead Tower')) {
    const deal = findDealByName('Buckhead Tower');
    if (deal) {
      return { type: 'pipeline-deal', id: deal.id, name: deal.name };
    }
  }
  
  // 3. Check contact association
  const contact = findContact(email.from);
  if (contact && contact.activeDeals.length > 0) {
    return {
      type: 'pipeline-deal',
      id: contact.activeDeals[0].id,
      name: contact.activeDeals[0].name
    };
  }
  
  // 4. User selects manually
  return promptUserToSelectDeal();
}
```

---

## 4. Task Views

### 4.1 Global Task Board (Kanban)

**Location:** TOOLS → Tasks (main page)

**Layout:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  🎯 Global Tasks                      [Filters ▼] [View: Kanban] [+ New Task]│
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  📋 Open (12)    📝 In Progress (5)    🚧 Blocked (2)    ✅ Complete (45)   │
│  ──────────────  ──────────────────   ───────────────    ─────────────────  │
│  │ Submit Phase│  │ Review rent    │  │ Waiting for  │  │ LOI accepted  │  │
│  │ I Report    │  │ roll           │  │ appraisal    │  │ Jan 25        │  │
│  │ Due: Feb 15 │  │ Due: Feb 10    │  │ Due: Feb 12  │  │               │  │
│  │ 🔴 High     │  │ 🟡 Medium      │  │ 🔴 High      │  │               │  │
│  │ Buckhead    │  │ Midtown Plaza  │  │ Buckhead     │  │               │  │
│  │ Tower       │  │                │  │ Tower        │  │               │  │
│  ──────────────  ──────────────────   ───────────────    ─────────────────  │
│  │ Schedule    │  │ Draft PSA      │                                         │
│  │ inspection  │  │ review         │                                         │
│  │ Due: Feb 12 │  │ Due: Feb 18    │                                         │
│  │ 🟡 Medium   │  │ 🔴 High        │                                         │
│  │ Buckhead    │  │ Buckhead       │                                         │
│  │ Tower       │  │ Tower          │                                         │
│  ──────────────  ──────────────────                                          │
│                                                                               │
│  [Drag to move tasks between columns]                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Filters:**
- By Deal/Property
- By Category
- By Assigned User
- By Priority
- By Due Date Range
- By Source (Email, Agent, Manual)

---

### 4.2 Per-Deal Task List

**Location:** Deal Page → Tasks Tab (or Context Tracker → Activity Timeline filtered)

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Buckhead Tower Development - Tasks                  │
├──────────────────────────────────────────────────────┤
│  Due Diligence (3 tasks)                             │
│  ☐ Submit Phase I Environmental (Due: Feb 15) 🔴     │
│  ☐ Schedule property inspection (Due: Feb 12) 🟡     │
│  ✅ Request updated rent roll (Completed Jan 28)     │
│  ───────────────────────────────────────────────    │
│  Financing (2 tasks)                                 │
│  ☐ Submit loan application (Due: Feb 20) 🔴          │
│  🚧 Waiting for appraisal (Blocked) 🔴               │
│  ───────────────────────────────────────────────    │
│  Legal (1 task)                                      │
│  📝 Draft PSA review (In Progress) 🔴                │
│  ───────────────────────────────────────────────    │
│  [+ Add Task]                                        │
└──────────────────────────────────────────────────────┘
```

---

### 4.3 Per-Property Task List

**Location:** Assets Owned → Property Page → Tasks Tab

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Midtown Towers - Property Tasks                     │
├──────────────────────────────────────────────────────┤
│  Operations (4 tasks)                                │
│  ☐ Repair HVAC Unit 3B (Due: Feb 10) 🔴             │
│  ☐ Schedule annual inspection (Due: Feb 28) 🟡      │
│  ✅ Process tenant move-out (Completed Feb 5)        │
│  ✅ Post vacant unit listing (Completed Feb 6)       │
│  ───────────────────────────────────────────────    │
│  Leasing (2 tasks)                                   │
│  ☐ Send renewal notices (Due: March 1) 🟡           │
│  ☐ Screen applicant for Unit 412 (Due: Feb 15) 🟡   │
│  ───────────────────────────────────────────────    │
│  Investor Relations (1 task)                         │
│  ☐ Send Q1 performance report (Due: April 1) ⚪      │
│  ───────────────────────────────────────────────    │
│  [+ Add Task]                                        │
└──────────────────────────────────────────────────────┘
```

---

### 4.4 "My Tasks" Sidebar View

**Location:** Sidebar → Quick view of tasks assigned to current user

**Layout:**
```
┌──────────────────────────────────┐
│  🎯 My Tasks (7)                 │
├──────────────────────────────────┤
│  Due Today (2)                   │
│  ⚪ Submit Phase I (Buckhead)    │
│  ⚪ Send rent roll (Midtown)     │
│  ───────────────────────────────│
│  This Week (5)                   │
│  ⚪ Schedule inspection          │
│  ⚪ Draft PSA review             │
│  ⚪ Submit loan app              │
│  ⚪ Repair HVAC                  │
│  ⚪ Screen applicant             │
│  ───────────────────────────────│
│  [View All Tasks →]              │
└──────────────────────────────────┘
```

---

### 4.5 Calendar Overlay

**Location:** Calendar integration (Google Calendar, Outlook, etc.)

**Features:**
- Task deadlines appear as events
- Color-coded by priority (Red = High, Yellow = Medium, White = Low)
- Click task → Opens deal/property context
- Drag to reschedule

**Calendar View:**
```
┌──────────────────────────────────────────────────────┐
│  📅 February 2026                                    │
├──────────────────────────────────────────────────────┤
│  Mon    Tue    Wed    Thu    Fri    Sat    Sun      │
│  10     11     12     13     14     15     16        │
│         🔴     🟡     🟡     🔴     🔴              │
│         Loan   Inspec Rent   Phase  Submit          │
│         App    tion   Roll   I      LOI             │
│                                                      │
│  [Click any task to view details]                    │
└──────────────────────────────────────────────────────┘
```

---

## 5. Task Categories

**Automatic Categorization Based on Context:**

| Category | Triggers | Typical Deal Stage |
|----------|----------|-------------------|
| **Due Diligence** | Phase I, inspection, title search, survey, environmental | Pre-acquisition (Pipeline) |
| **Financing** | Loan application, appraisal, lender docs, rate lock | Pre-acquisition |
| **Legal** | PSA review, entity formation, closing docs | Pre-acquisition |
| **Leasing** | Tenant screening, lease renewal, vacancy marketing | Post-acquisition (Assets Owned) |
| **Construction** | Permit approvals, contractor bids, inspections | Post-acquisition (Value-Add) |
| **Investor Relations** | Performance reports, K-1 prep, capital calls | Post-acquisition |
| **Operations** | Maintenance, tenant issues, utility setup | Post-acquisition |

---

## 6. Priority Auto-Scoring

**Algorithm:**
```typescript
function calculatePriority(task: Task): Priority {
  let score = 0;
  
  // 1. Deadline proximity
  if (task.dueDate) {
    const daysUntil = daysBetween(now(), task.dueDate);
    if (daysUntil <= 1) score += 50;
    else if (daysUntil <= 3) score += 30;
    else if (daysUntil <= 7) score += 15;
  }
  
  // 2. Deal stage urgency
  if (task.linkedEntity.type === 'pipeline-deal') {
    const deal = getDeal(task.linkedEntity.id);
    if (deal.stage === 'closing') score += 40;
    else if (deal.stage === 'due-diligence') score += 30;
    else if (deal.stage === 'loi') score += 20;
  }
  
  // 3. Category criticality
  if (task.category === 'financing' || task.category === 'legal') score += 20;
  
  // 4. Blocked dependents
  if (task.blocksTaskIds.length > 0) score += 15;
  
  // 5. Manual override
  if (task.manualPriority === 'high') score += 50;
  
  // Result
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}
```

---

## 7. Task Dependencies

**Example: Closing Preparation**

```
┌──────────────────────────────────────────────────────┐
│  Task: Close on Buckhead Tower                       │
│  Due: March 1, 2026                                  │
│  ───────────────────────────────────────────────    │
│  Dependencies (Must Complete First):                 │
│  ✅ Phase I Environmental (Completed Feb 15)         │
│  ✅ Property Inspection (Completed Feb 12)           │
│  ✅ Loan Approval (Completed Feb 22)                 │
│  🚧 Appraisal (Blocked - waiting on appraiser)       │
│  ☐ PSA Execution (Due Feb 25)                       │
│  ───────────────────────────────────────────────    │
│  Blocked By: Appraisal task                          │
│  Blocking: 0 tasks                                   │
│  ───────────────────────────────────────────────    │
│  [View Dependency Tree]                              │
└──────────────────────────────────────────────────────┘
```

---

## 8. Integration with Other Modules

### Email Agent → Tasks
- Email arrives → AI detects action → Task created
- Follow-up reminder → Task created
- Document request → Task created

### Tasks → Deal Context Tracker
- Task created → Appears in Activity Timeline
- Task completed → Activity Timeline updated
- Task blocked → Risk flag in Context Tracker

### Tasks → Calendar
- Task with due date → Calendar event
- Task rescheduled → Calendar updated
- Task completed → Calendar event marked complete

### Agent Alerts → Tasks
- Supply Agent → "Review supply impact" task
- Market Intelligence → "Review rate change impact" task
- Deal Tracker → "LOI accepted, start DD" → Multiple tasks

---

## 9. Database Schema

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Routing
  linked_entity_type VARCHAR(50) NOT NULL, -- pipeline-deal, assets-owned-property, global
  linked_entity_id UUID,
  
  -- Categorization
  category VARCHAR(50) NOT NULL,
  
  -- Assignment
  assigned_to_user_id UUID REFERENCES users(id),
  assigned_to_name TEXT,
  assigned_to_type VARCHAR(50), -- user, team-member, external-contact
  
  -- Priority
  priority VARCHAR(20) NOT NULL, -- high, medium, low
  priority_score INTEGER,
  manual_priority VARCHAR(20),
  
  -- Timing
  created_at TIMESTAMP NOT NULL,
  due_date TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Source
  source_type VARCHAR(50) NOT NULL, -- email, agent-alert, manual
  source_reference_id UUID,
  source_url TEXT,
  
  -- Status
  status VARCHAR(50) NOT NULL, -- open, in-progress, blocked, complete
  blocked_reason TEXT,
  
  -- Dependencies
  dependencies UUID[], -- Array of task IDs
  blocks_task_ids UUID[]
);

CREATE TABLE task_comments (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  user_name TEXT,
  comment TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE task_attachments (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to_user_id);
CREATE INDEX idx_tasks_linked_entity ON tasks(linked_entity_type, linked_entity_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
```

---

## 10. API Endpoints

```typescript
// Task CRUD
POST   /api/v1/tasks                    // Create task
GET    /api/v1/tasks                    // List tasks (with filters)
GET    /api/v1/tasks/:id                // Get task details
PATCH  /api/v1/tasks/:id                // Update task
DELETE /api/v1/tasks/:id                // Delete task

// Task Actions
POST   /api/v1/tasks/:id/complete       // Mark complete
POST   /api/v1/tasks/:id/block          // Mark blocked
POST   /api/v1/tasks/:id/unblock        // Unblock
POST   /api/v1/tasks/:id/assign         // Reassign

// Task Views
GET    /api/v1/tasks/my-tasks           // Current user's tasks
GET    /api/v1/tasks/global-board       // Global Kanban view
GET    /api/v1/tasks/by-deal/:dealId    // Tasks for specific deal
GET    /api/v1/tasks/by-property/:propId // Tasks for specific property

// Task Dependencies
POST   /api/v1/tasks/:id/dependencies   // Add dependency
DELETE /api/v1/tasks/:id/dependencies/:depId // Remove dependency
GET    /api/v1/tasks/:id/dependency-tree // Get full dependency tree

// Task Creation from Email
POST   /api/v1/tasks/from-email         // Create task from email
POST   /api/v1/tasks/auto-detect        // AI detect tasks in email

// Comments & Attachments
POST   /api/v1/tasks/:id/comments       // Add comment
POST   /api/v1/tasks/:id/attachments    // Upload attachment
```

---

## 11. Success Metrics

**Adoption:**
- % of tasks created automatically (vs manual)
- % of tasks linked to deals/properties
- % of email-generated tasks accepted by users

**Efficiency:**
- Time saved vs manual task tracking (target: 10 hours/week)
- Task completion rate (target: >85%)
- Average time to complete by category

**Quality:**
- % of tasks with accurate routing (target: >90%)
- % of dependencies correctly identified
- % of deadlines met

---

## 12. Implementation Roadmap

### Phase 1: Core Task System (2 weeks)
- Database schema
- Task CRUD APIs
- Global task board UI
- Per-deal/per-property task lists

### Phase 2: Email Integration (2 weeks)
- AI task detection from emails
- Follow-up task creation
- Document request detection
- Link email threads to tasks

### Phase 3: Advanced Features (2 weeks)
- Task dependencies
- Priority auto-scoring
- Calendar integration
- Agent-to-agent task triggers

### Phase 4: Context Tracker Integration (1 week)
- Activity Timeline integration
- Risk flags from blocked tasks
- Financial snapshot updates

---

**Total Implementation:** 7 weeks

**Status:** Specification Complete  
**Next:** Integrate with Deal Context Tracker specification  
**Module:** Global Tasks (TOOLS section)
