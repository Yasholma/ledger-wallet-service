import request from 'supertest';
// Import app - it will be re-imported in setup.ts beforeAll with correct pool
// The beforeAll hook ensures the app uses the test database
// Use the app from global which is set in setup.ts beforeAll
import appModule from '../../src/app';
let app: any = (global as any).__TEST_APP__ || appModule;
import { cleanupTestData, createTestUser, getWalletId, getWalletBalance } from './helpers';

describe('E2E: Wallets API', () => {
  // Ensure we use the app from global (set in setup.ts beforeAll)
  beforeAll(() => {
    if ((global as any).__TEST_APP__) {
      app = (global as any).__TEST_APP__;
    }
  });
  let userId: string;
  let walletId: string;

  beforeEach(async () => {
    await cleanupTestData();
    
    const user = await createTestUser('wallet@example.com', 'Wallet User');
    userId = user.id;
    walletId = user.walletId;
    
    // Ensure wallet was created
    expect(walletId).toBeDefined();
    expect(walletId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  describe('GET /api/v1/wallets/:userId/balance', () => {
    it('should return 0 balance for new wallet', async () => {
      const response = await request(app)
        .get(`/api/v1/wallets/${userId}/balance`)
        .expect(200);

      expect(response.body).toHaveProperty('balance');
      expect(response.body.balance).toBe(0);
      expect(response.body).toHaveProperty('wallet_id');
    });

    it('should return correct balance after funding', async () => {
      // Fund the wallet with unique payment reference
      const uniquePaymentRef = `payment-wallet-${Date.now()}-${Math.random()}`;
      await request(app)
        .post('/api/v1/transactions/fund')
        .set('Idempotency-Key', `fund-wallet-${Date.now()}`)
        .send({
          walletId,
          amount: 10000,
          externalPaymentRef: uniquePaymentRef,
        })
        .expect(201);

      const response = await request(app)
        .get(`/api/v1/wallets/${userId}/balance`)
        .expect(200);

      expect(response.body.balance).toBe(10000);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/v1/wallets/${fakeUserId}/balance`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('WALLET_NOT_FOUND');
    });
  });
});
