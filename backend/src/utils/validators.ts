/**
 * Validation Utilities
 * Input validation schemas using Joi
 */

import Joi from 'joi';

// User validation
export const userSchemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().min(1).max(100).required(),
    lastName: Joi.string().min(1).max(100).required(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  updateProfile: Joi.object({
    firstName: Joi.string().min(1).max(100),
    lastName: Joi.string().min(1).max(100),
    avatarUrl: Joi.string().uri(),
  }),
};

// Property validation
export const propertySchemas = {
  create: Joi.object({
    addressLine1: Joi.string().required(),
    addressLine2: Joi.string().allow('', null),
    city: Joi.string().required(),
    stateCode: Joi.string().length(2).required(),
    zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).required(),
    county: Joi.string(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    lotSizeSqft: Joi.number().integer().positive(),
    buildingSqft: Joi.number().integer().positive(),
    yearBuilt: Joi.number().integer().min(1800).max(new Date().getFullYear()),
    bedrooms: Joi.number().integer().min(0),
    bathrooms: Joi.number().min(0),
    currentUse: Joi.string(),
    propertyType: Joi.string().valid('residential', 'commercial', 'mixed-use', 'vacant'),
  }),
};

// Zoning lookup validation
export const zoningSchemas = {
  lookup: Joi.object({
    address: Joi.string().when('lat', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
    lat: Joi.number().min(-90).max(90),
    lng: Joi.number().min(-180).max(180),
    municipality: Joi.string(),
  }).or('address', 'lat'),

  district: Joi.object({
    municipality: Joi.string().required(),
    stateCode: Joi.string().length(2).required(),
    districtCode: Joi.string().required(),
  }),
};

// Helper function to validate request body
export function validate(schema: Joi.ObjectSchema, data: any): { error?: string; value?: any } {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return {
      error: error.details.map((d) => d.message).join(', '),
    };
  }

  return { value };
}
