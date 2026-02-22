import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validate<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message
        }))
      });
    }
    req.body = result.data;
    next();
  };
}

export const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const createDealSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  boundary: z.object({
    type: z.string(),
    coordinates: z.any(),
  }),
  projectType: z.string().optional(),
  projectIntent: z.string().nullable().optional(),
  targetUnits: z.number().int().positive().nullable().optional(),
  budget: z.number().positive().nullable().optional(),
  timelineStart: z.string().nullable().optional(),
  timelineEnd: z.string().nullable().optional(),
  tier: z.enum(['basic', 'professional', 'enterprise']).optional(),
  deal_category: z.enum(['pipeline', 'owned']).optional(),
  development_type: z.string().optional(),
  address: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const updateDealSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  projectType: z.string().optional(),
  projectIntent: z.string().nullable().optional(),
  targetUnits: z.number().int().positive().nullable().optional(),
  budget: z.number().positive().nullable().optional(),
  status: z.string().optional(),
  timelineStart: z.string().nullable().optional(),
  timelineEnd: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']).default('todo'),
  dealId: z.union([z.string(), z.number()]).optional(),
  dueDate: z.string().optional(),
  source: z.string().default('manual'),
  tags: z.array(z.string()).default([]),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']).optional(),
  dueDate: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateEmailSchema = z.object({
  is_read: z.boolean().optional(),
  is_flagged: z.boolean().optional(),
  is_archived: z.boolean().optional(),
  deal_id: z.number().int().nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});

export const geocodeSchema = z.object({
  address: z.string().min(1, 'Address is required'),
});

export const zoningLookupSchema = z.object({
  lat: z.number().min(-90).max(90, 'Invalid latitude'),
  lng: z.number().min(-180).max(180, 'Invalid longitude'),
  municipality: z.string().optional(),
});

export const analyzeSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  municipality: z.string().optional(),
  state: z.string().optional(),
  lot_size_sqft: z.number().positive('Lot size must be positive'),
});

export const apartmentSyncPullSchema = z.object({
  city: z.string().default('Atlanta'),
  state: z.string().length(2).default('GA'),
});
