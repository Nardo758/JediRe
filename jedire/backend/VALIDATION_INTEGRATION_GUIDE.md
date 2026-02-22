# Validation Integration Guide

Quick reference for applying Zod validation to routes.

---

## 🚀 Quick Start

### 1. Import validation tools
```typescript
import { validate } from '../middleware/validate';
import { DealIdSchema, UpdateDealSchema, PaginationSchema } from '../validation/schemas';
```

### 2. Apply to routes
```typescript
router.put('/deals/:dealId',
  validate({
    params: DealIdSchema,      // Validates URL params
    body: UpdateDealSchema,     // Validates request body
    query: PaginationSchema,    // Validates query params
  }),
  async (req, res) => {
    // req.params.dealId is now validated UUID
    // req.body is validated against UpdateDealSchema
    // req.query has validated pagination
  }
);
```

---

## 📚 Common Patterns

### Validate Path Parameters
```typescript
import { DealIdSchema, PropertyIdSchema, TaskIdSchema } from '../validation/schemas';

// Single ID
router.get('/deals/:dealId', 
  validate({ params: DealIdSchema }),
  async (req, res) => {
    const { dealId } = req.params; // Type-safe UUID
  }
);

// Multiple IDs
const DealPropertySchema = z.object({
  dealId: z.string().uuid(),
  propertyId: z.string().uuid(),
});

router.get('/deals/:dealId/properties/:propertyId',
  validate({ params: DealPropertySchema }),
  ...
);
```

### Validate Request Body
```typescript
import { CreateDealSchema, UpdateDealSchema } from '../validation/schemas';

// Create
router.post('/deals',
  validate({ body: CreateDealSchema }),
  async (req, res) => {
    const dealData = req.body; // Validated
  }
);

// Update (partial)
router.put('/deals/:dealId',
  validate({
    params: DealIdSchema,
    body: UpdateDealSchema,
  }),
  ...
);
```

### Validate Query Parameters
```typescript
import { PaginationSchema, SearchQuerySchema } from '../validation/schemas';

// Pagination
router.get('/deals',
  validate({ query: PaginationSchema }),
  async (req, res) => {
    const { page, limit } = req.query; // Type-safe numbers
  }
);

// Search
router.get('/search',
  validate({ query: SearchQuerySchema }),
  async (req, res) => {
    const { q, type, limit } = req.query;
  }
);
```

### Geographic Queries
```typescript
import { CoordinatesSchema, BoundingBoxSchema } from '../validation/schemas';

// Single point
const LocationQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(0.1).max(50),
});

router.get('/nearby',
  validate({ query: LocationQuerySchema }),
  async (req, res) => {
    const { lat, lng, radius } = req.query;
  }
);
```

---

## 🛠️ Creating Custom Schemas

### Simple Schema
```typescript
import { z } from 'zod';

const CustomSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).max(120),
  active: z.boolean().default(true),
});
```

### Enum Schema
```typescript
const StatusSchema = z.enum(['active', 'inactive', 'pending']);

const UpdateStatusSchema = z.object({
  status: StatusSchema,
});
```

### Optional Fields
```typescript
const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
});
```

### Nested Objects
```typescript
const AddressSchema = z.object({
  street: z.string().max(200),
  city: z.string().max(100),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
});

const CreatePropertySchema = z.object({
  name: z.string().min(1).max(200),
  address: AddressSchema,
  units: z.number().int().min(1),
});
```

### Arrays
```typescript
const BulkCreateSchema = z.object({
  items: z.array(CreateDealSchema).min(1).max(100),
});

const TagSchema = z.object({
  tags: z.array(z.string().max(50)).max(20),
});
```

---

## 🔍 Validation Examples by Route Type

### Deal Routes
```typescript
import { 
  DealIdSchema, 
  CreateDealSchema, 
  UpdateDealSchema,
  PaginationSchema 
} from '../validation/schemas';

// List deals
router.get('/', 
  validate({ query: PaginationSchema }),
  ...
);

// Get deal
router.get('/:dealId',
  validate({ params: DealIdSchema }),
  ...
);

// Create deal
router.post('/',
  validate({ body: CreateDealSchema }),
  ...
);

// Update deal
router.put('/:dealId',
  validate({
    params: DealIdSchema,
    body: UpdateDealSchema,
  }),
  ...
);

// Delete deal
router.delete('/:dealId',
  validate({ params: DealIdSchema }),
  ...
);
```

### Property Routes
```typescript
import { PropertyIdSchema, CreatePropertySchema } from '../validation/schemas';

router.get('/:propertyId',
  validate({ params: PropertyIdSchema }),
  ...
);

router.post('/',
  validate({ body: CreatePropertySchema }),
  ...
);
```

### Financial Routes
```typescript
import { DealIdSchema, FinancialInputSchema, ProformaSchema } from '../validation/schemas';

router.post('/deals/:dealId/financial-analysis',
  validate({
    params: DealIdSchema,
    body: FinancialInputSchema,
  }),
  ...
);

router.post('/deals/:dealId/proforma',
  validate({
    params: DealIdSchema,
    body: ProformaSchema,
  }),
  ...
);
```

### Search Routes
```typescript
import { SearchQuerySchema } from '../validation/schemas';

router.get('/search',
  validate({ query: SearchQuerySchema }),
  async (req, res) => {
    const { q, type, limit } = req.query;
    // q is validated string (1-500 chars)
    // type is 'deals' | 'properties' | 'contacts' | 'all'
    // limit is number (1-100)
  }
);
```

---

## ⚡ Advanced Usage

### Custom Error Messages
```typescript
const schema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter'),
});
```

### Transform & Coerce
```typescript
// Coerce string to number (for query params)
const QuerySchema = z.object({
  page: z.coerce.number().int().min(1),
  limit: z.coerce.number().int().min(1).max(100),
});

// Transform
const TrimmedSchema = z.object({
  name: z.string().transform(s => s.trim()),
});
```

### Conditional Validation
```typescript
const ConditionalSchema = z.object({
  type: z.enum(['apartment', 'land']),
  units: z.number().int().optional(),
}).refine(data => {
  // If type is apartment, units is required
  if (data.type === 'apartment' && !data.units) {
    return false;
  }
  return true;
}, { message: 'Units required for apartment type' });
```

### Reusable Schemas
```typescript
// Base schema
const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Extend
const DealSchema = BaseEntitySchema.extend({
  name: z.string().min(1).max(255),
  status: z.enum(['active', 'closed']),
});
```

---

## 🐛 Error Handling

### Automatic Error Response
```typescript
// The validate middleware automatically sends:
{
  "error": "Validation Error",
  "message": "Invalid request body",
  "details": [
    {
      "field": "email",
      "message": "Invalid email address"
    },
    {
      "field": "age",
      "message": "Number must be greater than or equal to 0"
    }
  ]
}
```

### Manual Validation
```typescript
import { validateBody } from '../validation/schemas';

// In handler
try {
  const data = validateBody(CreateDealSchema, req.body);
  // Use data
} catch (error) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.errors,
    });
  }
}
```

### Safe Parse
```typescript
import { safeParse } from '../validation/schemas';

const result = safeParse(CreateDealSchema, req.body);

if (!result.success) {
  return res.status(400).json({
    error: 'Validation failed',
    details: result.errors.errors,
  });
}

// Use result.data
const dealData = result.data;
```

---

## ✅ Checklist for New Routes

When creating a new route:

- [ ] Identify what needs validation (params, body, query)
- [ ] Use existing schema if available
- [ ] Create custom schema if needed
- [ ] Apply `validate()` middleware
- [ ] Test with invalid data
- [ ] Check error messages are helpful

---

## 📖 Reference

### All Available Schemas

**Common:**
- `UUIDSchema`
- `EmailSchema`
- `URLSchema`
- `DateSchema`
- `PositiveIntSchema`
- `NonNegativeIntSchema`
- `PaginationSchema`

**Geographic:**
- `CoordinatesSchema`
- `BoundingBoxSchema`
- `PolygonSchema`
- `GeoJSONPointSchema`
- `GeoJSONPolygonSchema`

**Deal:**
- `DealIdSchema`
- `ProjectTypeSchema`
- `ProjectIntentSchema`
- `DealTierSchema`
- `DealStatusSchema`
- `DealStateSchema`
- `CreateDealSchema`
- `UpdateDealSchema`

**Property:**
- `PropertyIdSchema`
- `PropertyTypeSchema`
- `CreatePropertySchema`

**Financial:**
- `FinancialInputSchema`
- `ProformaSchema`

**Design:**
- `DesignInputSchema`
- `ZoningCodeSchema`

**Market:**
- `MarketQuerySchema`
- `CompetitionRadiusSchema`

**User & Auth:**
- `RegisterSchema`
- `LoginSchema`
- `UpdateProfileSchema`

**Task:**
- `TaskIdSchema`
- `TaskStatusSchema`
- `TaskPrioritySchema`
- `CreateTaskSchema`
- `UpdateTaskSchema`

**Note:**
- `NoteIdSchema`
- `CreateNoteSchema`
- `UpdateNoteSchema`

**File:**
- `FileUploadSchema`

**Search:**
- `SearchQuerySchema`

**Notifications:**
- `NotificationPreferencesSchema`

---

## 🆘 Troubleshooting

### Issue: "Expected object, received undefined"
**Solution:** Check that middleware parses body correctly:
```typescript
app.use(express.json());  // Before routes
```

### Issue: Query params are strings, not numbers
**Solution:** Use `z.coerce.number()` for query params:
```typescript
z.object({
  page: z.coerce.number().int().min(1),  // Coerces string to number
})
```

### Issue: Optional fields failing validation
**Solution:** Use `.optional()` or provide default:
```typescript
z.string().optional()
z.string().default('default-value')
```

### Issue: Too strict validation
**Solution:** Relax constraints:
```typescript
// Before
z.string().min(1).max(10)

// After
z.string().max(100).optional()
```

---

## 📚 Learn More

- Zod Documentation: https://zod.dev
- Express Middleware: https://expressjs.com/en/guide/using-middleware.html
- Validation Best Practices: SECURITY_AUDIT.md

---

**Questions?** Check `/src/validation/schemas.ts` for schema definitions.
