/**
 * Comprehensive Input Validation Schemas with Zod
 * All user inputs must be validated before processing
 */

import { z } from 'zod';

// ============================================
// COMMON SCHEMAS
// ============================================

export const UUIDSchema = z.string().uuid({ message: 'Invalid UUID format' });

export const EmailSchema = z.string().email({ message: 'Invalid email address' });

export const URLSchema = z.string().url({ message: 'Invalid URL format' });

export const DateSchema = z.string().datetime({ message: 'Invalid ISO 8601 date format' });

export const PositiveIntSchema = z.number().int().positive({ message: 'Must be a positive integer' });

export const NonNegativeIntSchema = z.number().int().min(0, { message: 'Must be non-negative' });

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).optional(),
});

// ============================================
// GEOGRAPHIC SCHEMAS
// ============================================

export const CoordinatesSchema = z.object({
  lat: z.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90'),
  lng: z.number().min(-180, 'Longitude must be >= -180').max(180, 'Longitude must be <= 180'),
});

export const BoundingBoxSchema = z.object({
  north: z.number().min(-90).max(90),
  south: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
  west: z.number().min(-180).max(180),
});

export const PolygonSchema = z.array(
  z.array(z.number()).length(2, 'Each coordinate must be [lng, lat]')
).min(3, 'Polygon must have at least 3 points');

export const GeoJSONPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.array(z.number()).length(2),
});

export const GeoJSONPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.array(z.number()).length(2))),
});

// ============================================
// DEAL SCHEMAS
// ============================================

export const DealIdSchema = z.object({
  dealId: UUIDSchema,
});

export const ProjectTypeSchema = z.enum([
  'multifamily',
  'office',
  'retail',
  'industrial',
  'mixed-use',
  'land',
  'hotel',
  'self-storage',
  'senior-housing',
  'student-housing',
]);

export const ProjectIntentSchema = z.enum([
  'acquisition',
  'development',
  'redevelopment',
  'disposition',
  'refinance',
]);

export const DealTierSchema = z.enum(['basic', 'standard', 'premium']);

export const DealStatusSchema = z.enum([
  'active',
  'on-hold',
  'closed',
  'cancelled',
]);

export const DealStateSchema = z.enum([
  'SIGNAL_INTAKE',
  'FEASIBILITY',
  'DUE_DILIGENCE',
  'NEGOTIATION',
  'CLOSING',
  'CONSTRUCTION',
  'STABILIZATION',
  'ASSET_MANAGEMENT',
]);

export const CreateDealSchema = z.object({
  name: z.string().min(1, 'Deal name is required').max(255, 'Deal name too long'),
  projectType: ProjectTypeSchema,
  projectIntent: ProjectIntentSchema.optional(),
  tier: DealTierSchema.default('basic'),
  status: DealStatusSchema.default('active'),
  state: DealStateSchema.default('SIGNAL_INTAKE'),
  budget: z.number().min(0).max(1e12).optional(),
  targetUnits: z.number().int().min(0).max(100000).optional(),
  timelineStart: DateSchema.optional(),
  timelineEnd: DateSchema.optional(),
  address: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  boundary: GeoJSONPolygonSchema.optional(),
});

export const UpdateDealSchema = CreateDealSchema.partial();

// ============================================
// PROPERTY SCHEMAS
// ============================================

export const PropertyIdSchema = z.object({
  propertyId: UUIDSchema,
});

export const PropertyTypeSchema = z.enum([
  'apartment',
  'office',
  'retail',
  'industrial',
  'mixed-use',
  'land',
  'hotel',
  'parking',
  'warehouse',
]);

export const CreatePropertySchema = z.object({
  address: z.string().min(1).max(500),
  propertyType: PropertyTypeSchema,
  units: z.number().int().min(0).max(10000).optional(),
  squareFeet: z.number().min(0).max(10000000).optional(),
  yearBuilt: z.number().int().min(1800).max(new Date().getFullYear() + 10).optional(),
  location: CoordinatesSchema.optional(),
  parcelId: z.string().max(100).optional(),
  zoning: z.string().max(50).optional(),
});

// ============================================
// FINANCIAL SCHEMAS
// ============================================

export const FinancialInputSchema = z.object({
  purchasePrice: z.number().min(0).max(1e12),
  downPayment: z.number().min(0).max(100), // percentage
  interestRate: z.number().min(0).max(50), // percentage
  loanTerm: z.number().int().min(1).max(50), // years
  closingCosts: z.number().min(0).max(1e12).optional(),
  renovationCosts: z.number().min(0).max(1e12).optional(),
});

export const ProformaSchema = z.object({
  units: z.number().int().min(1).max(10000),
  avgRent: z.number().min(0).max(100000),
  occupancy: z.number().min(0).max(100),
  opex: z.number().min(0).max(1e12),
  capex: z.number().min(0).max(1e12).optional(),
  managementFee: z.number().min(0).max(100).optional(),
});

// ============================================
// DESIGN/ZONING SCHEMAS
// ============================================

export const DesignInputSchema = z.object({
  units: z.number().int().min(1, 'At least 1 unit required').max(10000, 'Max 10,000 units'),
  stories: z.number().int().min(1, 'At least 1 story').max(100, 'Max 100 stories'),
  lotArea: z.number().min(1, 'Lot area must be positive').max(1e9),
  buildingCoverage: z.number().min(0).max(100), // percentage
  parkingRatio: z.number().min(0).max(10), // spaces per unit
  setbacks: z.object({
    front: z.number().min(0).max(1000),
    rear: z.number().min(0).max(1000),
    side: z.number().min(0).max(1000),
  }).optional(),
  greenSpace: z.number().min(0).max(100).optional(), // percentage
});

export const ZoningCodeSchema = z.object({
  code: z.string().min(1).max(50),
  jurisdiction: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

// ============================================
// MARKET ANALYSIS SCHEMAS
// ============================================

export const MarketQuerySchema = z.object({
  location: CoordinatesSchema,
  radius: z.number().min(0.1).max(50), // miles
  propertyType: PropertyTypeSchema.optional(),
  minUnits: z.number().int().min(0).optional(),
  maxUnits: z.number().int().min(0).optional(),
  minYear: z.number().int().min(1800).optional(),
  maxYear: z.number().int().max(new Date().getFullYear() + 10).optional(),
});

export const CompetitionRadiusSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMiles: z.number().min(0.1, 'Minimum 0.1 miles').max(25, 'Maximum 25 miles'),
  propertyType: PropertyTypeSchema.optional(),
});

// ============================================
// USER & AUTH SCHEMAS
// ============================================

export const RegisterSchema = z.object({
  email: EmailSchema,
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number'),
  name: z.string().min(1).max(255),
  company: z.string().max(255).optional(),
});

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  company: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  avatar: URLSchema.optional(),
});

// ============================================
// TASK SCHEMAS
// ============================================

export const TaskIdSchema = z.object({
  taskId: UUIDSchema,
});

export const TaskStatusSchema = z.enum([
  'todo',
  'in-progress',
  'blocked',
  'done',
  'cancelled',
]);

export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  status: TaskStatusSchema.default('todo'),
  priority: TaskPrioritySchema.default('medium'),
  dueDate: DateSchema.optional(),
  assignedTo: UUIDSchema.optional(),
  dealId: UUIDSchema.optional(),
  propertyId: UUIDSchema.optional(),
});

export const UpdateTaskSchema = CreateTaskSchema.partial();

// ============================================
// NOTE SCHEMAS
// ============================================

export const NoteIdSchema = z.object({
  noteId: UUIDSchema,
});

export const CreateNoteSchema = z.object({
  content: z.string().min(1, 'Note content required').max(50000, 'Note too long'),
  dealId: UUIDSchema.optional(),
  propertyId: UUIDSchema.optional(),
  assetId: UUIDSchema.optional(),
  isPrivate: z.boolean().default(false),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const UpdateNoteSchema = CreateNoteSchema.partial();

// ============================================
// FILE UPLOAD SCHEMAS
// ============================================

export const FileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().max(100),
  size: z.number().int().min(1).max(100 * 1024 * 1024), // Max 100MB
  dealId: UUIDSchema.optional(),
  propertyId: UUIDSchema.optional(),
  category: z.enum([
    'document',
    'image',
    'spreadsheet',
    'presentation',
    'other',
  ]).default('document'),
});

// ============================================
// SEARCH SCHEMAS
// ============================================

export const SearchQuerySchema = z.object({
  q: z.string().min(1, 'Search query required').max(500),
  type: z.enum(['deals', 'properties', 'contacts', 'all']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================
// NOTIFICATION SCHEMAS
// ============================================

export const NotificationPreferencesSchema = z.object({
  emailEnabled: z.boolean().default(true),
  pushEnabled: z.boolean().default(true),
  dealUpdates: z.boolean().default(true),
  taskReminders: z.boolean().default(true),
  marketAlerts: z.boolean().default(false),
  weeklyDigest: z.boolean().default(true),
});

// ============================================
// EXPORT HELPER FUNCTIONS
// ============================================

/**
 * Validates request params against a schema
 * Throws ZodError if validation fails
 */
export function validateParams<T>(schema: z.ZodSchema<T>, params: unknown): T {
  return schema.parse(params);
}

/**
 * Validates request body against a schema
 * Throws ZodError if validation fails
 */
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  return schema.parse(body);
}

/**
 * Validates request query against a schema
 * Throws ZodError if validation fails
 */
export function validateQuery<T>(schema: z.ZodSchema<T>, query: unknown): T {
  return schema.parse(query);
}

/**
 * Safe parse with custom error handling
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}
