# Agent Dashboard Database Schema

## Overview
Complete CRM database schema for real estate agents built with Drizzle ORM. This schema supports comprehensive client management, deal tracking, lead generation, activity logging, and commission calculations.

## Architecture

### Schema Files
- **`shared/schema.ts`** - Drizzle ORM schema definitions with TypeScript types
- **`database/migrations/001_agent_dashboard_schema.sql`** - PostgreSQL migration file
- **`database/migrations/001_agent_dashboard_schema_rollback.sql`** - Rollback script

## Database Tables

### 1. **agent_clients**
Stores comprehensive client information for real estate agents.

**Key Features:**
- Contact information (email, phone, address)
- Client status tracking (active, inactive, archived, prospect)
- Client type classification (buyer, seller, both, investor, landlord)
- Communication preferences and best contact times
- Property search criteria
- Pre-approval tracking with lender information
- Agent assignment and referral source tracking
- Tags, notes, and custom fields

**Indexes:**
- `email`, `status`, `assigned_agent_id`, `created_at`, `client_type`

---

### 2. **agent_deals**
Tracks real estate transactions through the entire pipeline.

**Key Features:**
- Deal identification (name, number, type)
- Property information (address, type, MLS number)
- Deal stage tracking (lead → viewing → offer → negotiation → under_contract → closing → closed)
- Financial tracking (listing price, offer price, final price)
- Commission calculations with multiple structures
- Commission template integration
- Important date tracking (listing, offer, contract, inspection, appraisal, closing)
- Document storage with JSON metadata
- Probability scoring and pipeline management
- Co-agent and referral fee tracking

**Indexes:**
- `client_id`, `deal_stage`, `deal_status`, `closing_date`, `expected_close_date`, `created_at`, `deal_type`

**Foreign Keys:**
- `client_id` → `agent_clients.id` (CASCADE delete)
- `commission_template_id` → `agent_commission_templates.id` (SET NULL on delete)

---

### 3. **agent_leads**
Captures leads from various sources and tracks conversion.

**Key Features:**
- Lead source tracking (website, referral, Zillow, Realtor.com, Facebook, open house, etc.)
- Marketing attribution (source, medium, campaign)
- Lead quality scoring (hot, warm, cold)
- Status tracking (new → contacted → qualified → nurturing → converted)
- Interest intent tracking (buying, selling, renting, investing)
- Property preferences and price range
- Follow-up scheduling and contact attempt tracking
- Lead-to-client conversion tracking
- Agent assignment

**Indexes:**
- `email`, `status`, `source`, `follow_up_date`, `assigned_agent_id`, `captured_at`, `lead_quality`

**Foreign Keys:**
- `converted_to_client_id` → `agent_clients.id` (SET NULL on delete)

---

### 4. **agent_activities**
Activity log for all interactions with clients, deals, and leads.

**Key Features:**
- Activity type tracking (call, email, meeting, showing, text, note, task)
- Relationship to clients, deals, and leads
- Call details (direction, duration, outcome)
- Task management (due dates, completion status, priority)
- Meeting/showing location tracking
- Follow-up requirements and scheduling
- Participant tracking
- Attachment storage
- Tags and metadata

**Indexes:**
- `client_id`, `deal_id`, `lead_id`, `activity_type`, `status`, `scheduled_at`, `due_date`, `created_at`

**Foreign Keys:**
- `client_id` → `agent_clients.id` (CASCADE delete)
- `deal_id` → `agent_deals.id` (CASCADE delete)
- `lead_id` → `agent_leads.id` (CASCADE delete)

---

### 5. **agent_commission_templates**
Reusable commission calculation templates.

**Key Features:**
- Multiple commission types:
  - **Percentage**: Buyer agent rate, listing agent rate
  - **Flat Fee**: Fixed dollar amount
  - **Tiered**: Different rates based on price ranges
  - **Hybrid**: Combination structures
- Agent/brokerage split configuration
- Transaction fees and additional fees
- Calculation rules (minimums, maximums, rounding)
- Property type restrictions
- Deal type applicability
- Usage tracking
- Default template support

**Indexes:**
- `name`, `is_default`, `is_active`

---

## Relationships

```
agent_clients
  ├─ has many → agent_deals
  ├─ has many → agent_activities
  └─ converted from → agent_leads

agent_deals
  ├─ belongs to → agent_clients
  ├─ has many → agent_activities
  └─ uses → agent_commission_templates

agent_leads
  ├─ has many → agent_activities
  └─ converts to → agent_clients

agent_activities
  ├─ belongs to → agent_clients (optional)
  ├─ belongs to → agent_deals (optional)
  └─ belongs to → agent_leads (optional)

agent_commission_templates
  └─ used by many → agent_deals
```

## TypeScript Types

### Insert Types (for creating records)
```typescript
InsertAgentClient
InsertAgentDeal
InsertAgentLead
InsertAgentActivity
InsertAgentCommissionTemplate
```

### Select Types (full records)
```typescript
AgentClient
AgentDeal
AgentLead
AgentActivity
AgentCommissionTemplate
```

### Utility Types
```typescript
DealStage = "lead" | "viewing" | "offer" | "negotiation" | "under_contract" | "closing" | "closed" | "dead"
DealStatus = "active" | "pending" | "closed_won" | "closed_lost" | "cancelled"
ClientStatus = "active" | "inactive" | "archived" | "prospect"
LeadStatus = "new" | "contacted" | "qualified" | "unqualified" | "nurturing" | "converted" | "dead"
ActivityType = "call" | "email" | "meeting" | "showing" | "text" | "note" | "task" | "follow_up"
```

## Features

### Automatic Timestamps
All tables include `created_at` and `updated_at` fields with automatic triggers for updates.

### Flexible JSON Fields
- `communication_preferences` - Custom communication settings
- `search_criteria` - Property search parameters
- `tags` - Flexible tagging system
- `documents` - File metadata storage
- `contingencies` - Deal contingencies list
- `tiers` - Tiered commission structures
- `calculation_rules` - Custom commission calculation logic

### Indexes for Performance
All tables include strategic indexes on:
- Foreign keys
- Status/state fields
- Date fields (for range queries)
- Search fields (email, source)

### Default Data
The migration includes 4 pre-configured commission templates:
1. Standard 6% (3%/3% Split) - *Default*
2. Buyer Agent 2.5%
3. Listing Agent 5%
4. Flat Fee $5,000

## Usage Examples

### Creating a Client
```typescript
import { db } from './db';
import { agentClients } from './shared/schema';

await db.insert(agentClients).values({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phoneNumber: '555-1234',
  status: 'active',
  clientType: 'buyer',
  searchCriteria: {
    propertyTypes: ['single-family', 'condo'],
    minPrice: 300000,
    maxPrice: 500000,
    bedrooms: 3,
    locations: ['Austin', 'Round Rock']
  }
});
```

### Creating a Deal
```typescript
import { agentDeals } from './shared/schema';

await db.insert(agentDeals).values({
  dealName: '123 Main St - Smith Purchase',
  clientId: clientId,
  propertyAddress: '123 Main St',
  propertyCity: 'Austin',
  propertyState: 'TX',
  dealType: 'purchase',
  dealStage: 'offer',
  listingPrice: 450000,
  offerPrice: 440000,
  commissionRate: 3.0,
  expectedCloseDate: new Date('2024-03-15')
});
```

### Tracking Activities
```typescript
import { agentActivities } from './shared/schema';

await db.insert(agentActivities).values({
  activityType: 'call',
  subject: 'Follow-up on property showing',
  clientId: clientId,
  dealId: dealId,
  direction: 'outbound',
  duration: 15,
  outcome: 'successful',
  status: 'completed',
  completedAt: new Date(),
  notes: 'Client is very interested in the property'
});
```

### Querying with Relations
```typescript
import { eq } from 'drizzle-orm';

// Get client with all their deals and activities
const clientWithDeals = await db.query.agentClients.findFirst({
  where: eq(agentClients.id, clientId),
  with: {
    deals: true,
    activities: {
      orderBy: (activities, { desc }) => [desc(activities.createdAt)],
      limit: 10
    }
  }
});
```

## Migration Commands

### Apply Migration
```bash
psql -U your_user -d your_database -f database/migrations/001_agent_dashboard_schema.sql
```

### Rollback Migration
```bash
psql -U your_user -d your_database -f database/migrations/001_agent_dashboard_schema_rollback.sql
```

### Using Drizzle Kit
```bash
# Generate migration
npx drizzle-kit generate:pg

# Run migration
npx drizzle-kit push:pg
```

## Configuration

### Drizzle Config Example (`drizzle.config.ts`)
```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./shared/schema.ts",
  out: "./database/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  }
} satisfies Config;
```

## Best Practices

1. **Always use transactions** for multi-table operations
2. **Validate input** using the provided Zod schemas
3. **Use proper indexes** - they're already defined in the schema
4. **Soft delete** - Use status fields instead of hard deletes when possible
5. **Audit trails** - Activities table provides comprehensive logging
6. **Commission calculations** - Use templates for consistency

## Security Considerations

- Sensitive client data should be encrypted at rest
- Apply row-level security (RLS) if using multi-tenant setup
- Restrict database user permissions appropriately
- Always use prepared statements (Drizzle handles this)
- Validate file uploads before storing URLs

## Performance Tips

1. **Use limit and offset** for pagination on large datasets
2. **Leverage indexes** - all critical fields are indexed
3. **Batch operations** when creating multiple records
4. **Use select specific fields** instead of `SELECT *`
5. **Monitor query performance** and add indexes as needed

## Future Enhancements

Potential additions to consider:
- Document version tracking
- Email/SMS integration logs
- Calendar sync integration
- Property photos/videos storage
- Contract template management
- E-signature tracking
- Commission payment tracking with invoicing
- Team collaboration features
- Analytics and reporting tables

## Support & Maintenance

- Schema version: 1.0.0
- Last updated: 2024-02-04
- Drizzle ORM version: Latest
- PostgreSQL version: 12+

For issues or questions, refer to:
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
