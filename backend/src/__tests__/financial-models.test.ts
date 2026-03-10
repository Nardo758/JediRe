/**
 * Financial Models API Integration Tests
 * 
 * Tests Claude compute endpoints, assumptions assembly, validation.
 */

import request from 'supertest';
import { app } from '../index';
import { query } from '../database/connection';

describe('Financial Models API', () => {
  let authToken: string;
  let userId: string;
  let dealId: string;

  beforeAll(async () => {
    // Setup: Create test user and deal
    // (In real tests, use test database and proper fixtures)
    authToken = 'test-token';
    userId = 'test-user-id';
    dealId = 'test-deal-id';
  });

  afterAll(async () => {
    // Cleanup test data
  });

  describe('POST /api/v1/financial-models/:dealId/compute-claude', () => {
    it('should compute financial model with Claude', async () => {
      const response = await request(app)
        .post(`/api/v1/financial-models/${dealId}/compute-claude`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          forceRecompute: true,
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('model');
      expect(response.body.data).toHaveProperty('validation');
      expect(response.body.data).toHaveProperty('metadata');
      
      const { model, validation, metadata } = response.body.data;
      
      // Model should have required fields
      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('deal_id', dealId);
      expect(model).toHaveProperty('model_type');
      expect(model).toHaveProperty('claude_output');
      
      // Validation should be present
      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('errors');
      expect(validation).toHaveProperty('warnings');
      
      // Metadata should include model type and timestamp
      expect(metadata).toHaveProperty('modelType');
      expect(metadata).toHaveProperty('computedAt');
      expect(metadata).toHaveProperty('cached');
    });

    it('should use cache on second call', async () => {
      // First call
      await request(app)
        .post(`/api/v1/financial-models/${dealId}/compute-claude`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      // Second call (should hit cache)
      const response = await request(app)
        .post(`/api/v1/financial-models/${dealId}/compute-claude`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body.data.metadata.cached).toBe(true);
    });

    it('should accept model type override', async () => {
      const response = await request(app)
        .post(`/api/v1/financial-models/${dealId}/compute-claude`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          modelTypeOverride: 'development',
        })
        .expect(200);

      expect(response.body.data.metadata.modelType).toBe('development');
    });

    it('should return 404 for non-existent deal', async () => {
      await request(app)
        .post(`/api/v1/financial-models/non-existent-deal/compute-claude`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(404);
    });
  });

  describe('GET /api/v1/financial-models/:dealId/claude-output', () => {
    it('should fetch Claude-computed output', async () => {
      // First compute a model
      await request(app)
        .post(`/api/v1/financial-models/${dealId}/compute-claude`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      // Then fetch it
      const response = await request(app)
        .get(`/api/v1/financial-models/${dealId}/claude-output`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('claude_output');
      expect(response.body.data).toHaveProperty('model_type');
      expect(response.body.data).toHaveProperty('computed_at');
    });

    it('should return 404 if no Claude output exists', async () => {
      await request(app)
        .get(`/api/v1/financial-models/deal-without-model/claude-output`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/v1/financial-models/:dealId/assumptions', () => {
    it('should fetch assembled assumptions', async () => {
      const response = await request(app)
        .get(`/api/v1/financial-models/${dealId}/assumptions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.metadata).toHaveProperty('modelType');
      expect(response.body.metadata).toHaveProperty('dealId');
      
      // Assumptions should have source attribution
      const assumptions = response.body.data;
      expect(assumptions).toBeTruthy();
    });
  });

  describe('PATCH /api/v1/financial-models/:dealId/assumptions', () => {
    it('should update assumptions with user overrides', async () => {
      const updates = {
        rentGrowth: 0.035,
        exitCapRate: 0.055,
      };

      const response = await request(app)
        .patch(`/api/v1/financial-models/${dealId}/assumptions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.updated).toBe(2);
      
      // Verify assumptions were logged to history
      const historyResult = await query(
        'SELECT * FROM assumption_history WHERE deal_id = $1 AND changed_by = $2 ORDER BY changed_at DESC LIMIT 2',
        [dealId, userId]
      );
      
      expect(historyResult.rows).toHaveLength(2);
      expect(historyResult.rows[0].source).toBe('user');
    });
  });

  describe('POST /api/v1/financial-models/:dealId/validate', () => {
    it('should validate existing model output', async () => {
      // First compute a model
      await request(app)
        .post(`/api/v1/financial-models/${dealId}/compute-claude`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      // Then validate it
      const response = await request(app)
        .post(`/api/v1/financial-models/${dealId}/validate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('validation');
      expect(response.body.data.validation).toHaveProperty('isValid');
      expect(response.body.data.validation).toHaveProperty('errors');
      expect(response.body.data.validation).toHaveProperty('warnings');
      expect(response.body.data.validation).toHaveProperty('passed');
      expect(response.body.data.validation).toHaveProperty('failed');
    });
  });

  describe('CRUD Operations (existing routes)', () => {
    it('should list all financial models', async () => {
      const response = await request(app)
        .get('/api/v1/financial-models')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should create a financial model', async () => {
      const response = await request(app)
        .post('/api/v1/financial-models')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dealId: dealId,
          name: 'Test Model',
          version: 1,
          components: [],
          assumptions: { rentGrowth: 0.03 },
          results: { irr: 0.15 },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('Test Model');
    });

    it('should get financial model for deal', async () => {
      const response = await request(app)
        .get(`/api/v1/financial-models/${dealId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deal_id', dealId);
    });

    it('should update a financial model', async () => {
      // First create a model
      const createResponse = await request(app)
        .post('/api/v1/financial-models')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dealId: dealId,
          name: 'Original Name',
        });

      const modelId = createResponse.body.data.id;

      // Then update it
      const response = await request(app)
        .patch(`/api/v1/financial-models/${modelId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Name',
          version: 2,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.version).toBe(2);
    });

    it('should delete a financial model', async () => {
      // First create a model
      const createResponse = await request(app)
        .post('/api/v1/financial-models')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dealId: dealId,
          name: 'To Be Deleted',
        });

      const modelId = createResponse.body.data.id;

      // Then delete it
      const response = await request(app)
        .delete(`/api/v1/financial-models/${modelId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify it's gone
      await request(app)
        .patch(`/api/v1/financial-models/${modelId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Should Fail' })
        .expect(404);
    });
  });
});
