import request from 'supertest';
import app from '../../src/app';
import { cleanupTestData, createTestUser } from './helpers';

describe('E2E: Users API', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe('POST /api/v1/users', () => {
    it('should create a new user successfully', async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .send({
          email: 'test@example.com',
          name: 'Test User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.name).toBe('Test User');
      expect(response.body.user).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('wallet');
      expect(response.body.wallet).toHaveProperty('id');
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .send({
          email: 'invalid-email',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .send({
          email: 'test@example.com',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 409 for duplicate email', async () => {
      // Create first user (now uses app's pool, so it will be visible)
      await createTestUser('duplicate@example.com', 'First User');

      // Try to create duplicate via API
      const response = await request(app)
        .post('/api/v1/users')
        .send({
          email: 'duplicate@example.com',
          name: 'Second User',
        })
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('DUPLICATE_EMAIL');
    });
  });
});
