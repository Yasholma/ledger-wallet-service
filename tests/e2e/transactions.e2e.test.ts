import request from "supertest";
// Import app - it will be re-imported in setup.ts beforeAll with correct pool
// The beforeAll hook ensures the app uses the test database
// Use the app from global which is set in setup.ts beforeAll
import appModule from "../../src/app";
let app: any = (global as any).__TEST_APP__ || appModule;
import {
  cleanupTestData,
  createTestUser,
  getWalletId,
  getWalletBalance,
  countLedgerEntries,
} from "./helpers";

describe("E2E: Transactions API", () => {
  // Ensure we use the app from global (set in setup.ts beforeAll)
  beforeAll(() => {
    if ((global as any).__TEST_APP__) {
      app = (global as any).__TEST_APP__;
    }
  });
  let user1Id: string;
  let user2Id: string;
  let wallet1Id: string;
  let wallet2Id: string;

  beforeEach(async () => {
    await cleanupTestData();

    const user1 = await createTestUser("user1@example.com", "User 1");
    const user2 = await createTestUser("user2@example.com", "User 2");
    user1Id = user1.id;
    user2Id = user2.id;
    wallet1Id = user1.walletId;
    wallet2Id = user2.walletId;

    // Ensure wallets were created
    expect(wallet1Id).toBeDefined();
    expect(wallet2Id).toBeDefined();
    expect(wallet1Id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(wallet2Id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  describe("POST /api/v1/transactions/fund", () => {
    it("should fund a wallet successfully", async () => {
      // Use unique payment reference to avoid conflicts
      const uniquePaymentRef = `payment-transactions-${Date.now()}-${Math.random()}`;
      const response = await request(app)
        .post("/api/v1/transactions/fund")
        .set("Idempotency-Key", `fund-transactions-${Date.now()}`)
        .send({
          walletId: wallet1Id,
          amount: 5000,
          externalPaymentRef: uniquePaymentRef,
        })
        .expect(201);

      expect(response.body).toHaveProperty("transaction");
      expect(response.body.transaction).toHaveProperty("id");
      expect(response.body.transaction.amount).toBe(5000);
      expect(response.body.transaction.direction).toBe("credit");
      expect(response.body.transaction.external_payment_ref).toBe(
        uniquePaymentRef
      );

      // Verify balance updated
      const balance = await getWalletBalance(wallet1Id);
      expect(balance).toBe(5000);
    });

    it("should return same response for duplicate idempotency key", async () => {
      // Use unique idempotency key and payment ref to avoid conflicts
      const idempotencyKey = `fund-duplicate-${Date.now()}-${Math.random()}`;
      const uniquePaymentRef = `payment-duplicate-${Date.now()}-${Math.random()}`;

      const response1 = await request(app)
        .post("/api/v1/transactions/fund")
        .set("Idempotency-Key", idempotencyKey)
        .send({
          walletId: wallet1Id,
          amount: 3000,
          externalPaymentRef: uniquePaymentRef,
        })
        .expect(201);

      const response2 = await request(app)
        .post("/api/v1/transactions/fund")
        .set("Idempotency-Key", idempotencyKey)
        .send({
          walletId: wallet1Id,
          amount: 3000,
          externalPaymentRef: uniquePaymentRef,
        })
        .expect(201);

      // Should return same response
      expect(response1.body.transaction.id).toBe(response2.body.transaction.id);
      expect(response1.body.transaction.amount).toBe(
        response2.body.transaction.amount
      );

      // Should only have one ledger entry
      const entryCount = await countLedgerEntries(wallet1Id);
      expect(entryCount).toBe(1);
    });

    it("should return 409 when same idempotency key is used with different payload", async () => {
      // Use unique idempotency key and payment ref to avoid conflicts
      const idempotencyKey = `fund-conflict-${Date.now()}-${Math.random()}`;
      const uniquePaymentRef1 = `payment-conflict-1-${Date.now()}-${Math.random()}`;
      const uniquePaymentRef2 = `payment-conflict-2-${Date.now()}-${Math.random()}`;

      // First request with idempotency key and payload A
      await request(app)
        .post("/api/v1/transactions/fund")
        .set("Idempotency-Key", idempotencyKey)
        .send({
          walletId: wallet1Id,
          amount: 3000,
          externalPaymentRef: uniquePaymentRef1,
        })
        .expect(201);

      // Second request with same idempotency key but different payload (different amount)
      const response = await request(app)
        .post("/api/v1/transactions/fund")
        .set("Idempotency-Key", idempotencyKey)
        .send({
          walletId: wallet1Id,
          amount: 5000, // Different amount
          externalPaymentRef: uniquePaymentRef2,
        })
        .expect(409);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("IDEMPOTENCY_KEY_CONFLICT");
      expect(response.body.message).toContain(
        "Idempotency key exists but request does not match"
      );

      // Should still have only one ledger entry (from first request)
      const entryCount = await countLedgerEntries(wallet1Id);
      expect(entryCount).toBe(1);
    });

    it("should prevent duplicate external payment ref", async () => {
      // Use unique external ref to avoid conflicts with other tests
      const externalRef = `payment-unique-${Date.now()}-${Math.random()}`;

      await request(app)
        .post("/api/v1/transactions/fund")
        .set("Idempotency-Key", `fund-2-${Date.now()}`)
        .send({
          walletId: wallet1Id,
          amount: 2000,
          externalPaymentRef: externalRef,
        })
        .expect(201);

      // Try to fund again with same external payment ref (different idempotency key)
      await request(app)
        .post("/api/v1/transactions/fund")
        .set("Idempotency-Key", `fund-3-${Date.now()}`)
        .send({
          walletId: wallet1Id,
          amount: 2000,
          externalPaymentRef: externalRef,
        })
        .expect(409);

      // Should still have only one entry
      const entryCount = await countLedgerEntries(wallet1Id);
      expect(entryCount).toBe(1);
    });

    it("should return 400 for invalid amount", async () => {
      const response = await request(app)
        .post("/api/v1/transactions/fund")
        .set("Idempotency-Key", "fund-invalid")
        .send({
          walletId: wallet1Id,
          amount: -100,
          externalPaymentRef: "payment-invalid",
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 for amount exceeding maximum limit", async () => {
      const maxAmount = 1_000_000_000_000; // 10 billion dollars in cents
      const response = await request(app)
        .post("/api/v1/transactions/fund")
        .set("Idempotency-Key", `fund-max-${Date.now()}`)
        .send({
          walletId: wallet1Id,
          amount: maxAmount + 1,
          externalPaymentRef: `payment-max-${Date.now()}`,
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("VALIDATION_ERROR");
      expect(response.body.message).toContain(
        "Amount exceeds maximum allowed value"
      );
    });

    it("should return 400 for external payment ref exceeding 255 characters", async () => {
      const longPaymentRef = "a".repeat(256); // 256 characters
      const response = await request(app)
        .post("/api/v1/transactions/fund")
        .set("Idempotency-Key", `fund-long-ref-${Date.now()}`)
        .send({
          walletId: wallet1Id,
          amount: 1000,
          externalPaymentRef: longPaymentRef,
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("VALIDATION_ERROR");
      expect(response.body.message).toContain(
        "External payment reference must not exceed 255 characters"
      );
    });

    it("should return 400 for idempotency key exceeding 255 characters", async () => {
      const longIdempotencyKey = "a".repeat(256); // 256 characters
      const response = await request(app)
        .post("/api/v1/transactions/fund")
        .set("Idempotency-Key", longIdempotencyKey)
        .send({
          walletId: wallet1Id,
          amount: 1000,
          externalPaymentRef: `payment-key-test-${Date.now()}`,
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("VALIDATION_ERROR");
      expect(response.body.message).toContain(
        "Idempotency key must not exceed 255 characters"
      );
    });

    it("should return 400 for empty idempotency key", async () => {
      const response = await request(app)
        .post("/api/v1/transactions/fund")
        .set("Idempotency-Key", "")
        .send({
          walletId: wallet1Id,
          amount: 1000,
          externalPaymentRef: `payment-empty-key-${Date.now()}`,
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("VALIDATION_ERROR");
      expect(response.body.message).toContain(
        "Idempotency key cannot be empty"
      );
    });
  });

  describe("POST /api/v1/transactions/transfer", () => {
    beforeEach(async () => {
      // Fund wallet1 before each transfer test
      await request(app)
        .post("/api/v1/transactions/fund")
        .set("Idempotency-Key", `fund-setup-${Date.now()}`)
        .send({
          walletId: wallet1Id,
          amount: 10000,
          externalPaymentRef: `setup-payment-${Date.now()}`,
        });
    });

    it("should transfer funds successfully", async () => {
      const response = await request(app)
        .post("/api/v1/transactions/transfer")
        .set("Idempotency-Key", "transfer-1")
        .send({
          senderWalletId: wallet1Id,
          receiverWalletId: wallet2Id,
          amount: 3000,
        })
        .expect(201);

      expect(response.body).toHaveProperty("transfer");
      expect(response.body.transfer).toHaveProperty("id");
      expect(response.body.transfer.amount).toBe(3000);
      expect(response.body.transfer.sender_wallet_id).toBe(wallet1Id);
      expect(response.body.transfer.receiver_wallet_id).toBe(wallet2Id);
      expect(response.body.transfer.status).toBe("completed");

      // Verify balances
      const balance1 = await getWalletBalance(wallet1Id);
      const balance2 = await getWalletBalance(wallet2Id);
      expect(balance1).toBe(7000); // 10000 - 3000
      expect(balance2).toBe(3000); // 0 + 3000
    });

    it("should return 400 for insufficient balance", async () => {
      const response = await request(app)
        .post("/api/v1/transactions/transfer")
        .set("Idempotency-Key", "transfer-insufficient")
        .send({
          senderWalletId: wallet1Id,
          receiverWalletId: wallet2Id,
          amount: 20000, // More than available
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("INSUFFICIENT_BALANCE");

      // Verify balances unchanged
      const balance1 = await getWalletBalance(wallet1Id);
      const balance2 = await getWalletBalance(wallet2Id);
      expect(balance1).toBe(10000);
      expect(balance2).toBe(0);
    });

    it("should return same response for duplicate idempotency key", async () => {
      const idempotencyKey = "transfer-duplicate-1";

      const response1 = await request(app)
        .post("/api/v1/transactions/transfer")
        .set("Idempotency-Key", idempotencyKey)
        .send({
          senderWalletId: wallet1Id,
          receiverWalletId: wallet2Id,
          amount: 2000,
        })
        .expect(201);

      const response2 = await request(app)
        .post("/api/v1/transactions/transfer")
        .set("Idempotency-Key", idempotencyKey)
        .send({
          senderWalletId: wallet1Id,
          receiverWalletId: wallet2Id,
          amount: 2000,
        })
        .expect(201);

      // Should return same transfer ID
      expect(response1.body.transfer.id).toBe(response2.body.transfer.id);

      // Should only transfer once
      const balance1 = await getWalletBalance(wallet1Id);
      const balance2 = await getWalletBalance(wallet2Id);
      expect(balance1).toBe(8000); // 10000 - 2000 (only once)
      expect(balance2).toBe(2000); // 0 + 2000 (only once)
    });

    it("should return 409 when same idempotency key is used with different payload", async () => {
      const idempotencyKey = `transfer-conflict-${Date.now()}-${Math.random()}`;

      // First request with idempotency key and payload A
      await request(app)
        .post("/api/v1/transactions/transfer")
        .set("Idempotency-Key", idempotencyKey)
        .send({
          senderWalletId: wallet1Id,
          receiverWalletId: wallet2Id,
          amount: 2000,
        })
        .expect(201);

      // Second request with same idempotency key but different payload (different amount)
      const response = await request(app)
        .post("/api/v1/transactions/transfer")
        .set("Idempotency-Key", idempotencyKey)
        .send({
          senderWalletId: wallet1Id,
          receiverWalletId: wallet2Id,
          amount: 3000, // Different amount
        })
        .expect(409);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("IDEMPOTENCY_KEY_CONFLICT");
      expect(response.body.message).toContain(
        "Idempotency key exists but request does not match"
      );

      // Should only have transferred once (from first request)
      const balance1 = await getWalletBalance(wallet1Id);
      const balance2 = await getWalletBalance(wallet2Id);
      expect(balance1).toBe(8000); // 10000 - 2000 (only first transfer executed)
      expect(balance2).toBe(2000); // 0 + 2000 (only first transfer executed)
    });

    it("should return 400 for zero amount", async () => {
      const response = await request(app)
        .post("/api/v1/transactions/transfer")
        .set("Idempotency-Key", "transfer-zero")
        .send({
          senderWalletId: wallet1Id,
          receiverWalletId: wallet2Id,
          amount: 0,
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });

    it("should return 400 when transferring from wallet to itself", async () => {
      const response = await request(app)
        .post("/api/v1/transactions/transfer")
        .set("Idempotency-Key", "transfer-self")
        .send({
          senderWalletId: wallet1Id,
          receiverWalletId: wallet1Id,
          amount: 1000,
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("VALIDATION_ERROR");
      expect(response.body.message).toContain(
        "Cannot transfer funds from a wallet to itself"
      );
    });

    it("should return 404 for non-existent wallet", async () => {
      const fakeWalletId = "00000000-0000-0000-0000-000000000000";
      const response = await request(app)
        .post("/api/v1/transactions/transfer")
        .set("Idempotency-Key", "transfer-not-found")
        .send({
          senderWalletId: fakeWalletId,
          receiverWalletId: wallet2Id,
          amount: 1000,
        })
        .expect(404);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("WALLET_NOT_FOUND");
    });

    it("should return 400 for amount exceeding maximum limit", async () => {
      const maxAmount = 1_000_000_000_000; // 10 billion dollars in cents
      const response = await request(app)
        .post("/api/v1/transactions/transfer")
        .set("Idempotency-Key", `transfer-max-${Date.now()}`)
        .send({
          senderWalletId: wallet1Id,
          receiverWalletId: wallet2Id,
          amount: maxAmount + 1,
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("VALIDATION_ERROR");
      expect(response.body.message).toContain(
        "Amount exceeds maximum allowed value"
      );
    });

    it("should return 400 for idempotency key exceeding 255 characters in transfer", async () => {
      const longIdempotencyKey = "a".repeat(256); // 256 characters
      const response = await request(app)
        .post("/api/v1/transactions/transfer")
        .set("Idempotency-Key", longIdempotencyKey)
        .send({
          senderWalletId: wallet1Id,
          receiverWalletId: wallet2Id,
          amount: 1000,
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("VALIDATION_ERROR");
      expect(response.body.message).toContain(
        "Idempotency key must not exceed 255 characters"
      );
    });

    it("should return 400 for empty idempotency key in transfer", async () => {
      const response = await request(app)
        .post("/api/v1/transactions/transfer")
        .set("Idempotency-Key", "")
        .send({
          senderWalletId: wallet1Id,
          receiverWalletId: wallet2Id,
          amount: 1000,
        })
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("VALIDATION_ERROR");
      expect(response.body.message).toContain(
        "Idempotency key cannot be empty"
      );
    });
  });

  describe("GET /api/v1/transactions", () => {
    beforeEach(async () => {
      // Create some transactions
      await request(app)
        .post("/api/v1/transactions/fund")
        .set("Idempotency-Key", "fund-query-1")
        .send({
          walletId: wallet1Id,
          amount: 5000,
          externalPaymentRef: "payment-query-1",
        });

      await request(app)
        .post("/api/v1/transactions/fund")
        .set("Idempotency-Key", "fund-query-2")
        .send({
          walletId: wallet1Id,
          amount: 3000,
          externalPaymentRef: "payment-query-2",
        });
    });

    it("should return ledger entries for a wallet", async () => {
      const response = await request(app)
        .get(`/api/v1/transactions?walletId=${wallet1Id}`)
        .expect(200);

      expect(response.body).toHaveProperty("transactions");
      expect(Array.isArray(response.body.transactions)).toBe(true);
      expect(response.body.transactions.length).toBe(2);
      expect(response.body.transactions[0]).toHaveProperty("id");
      expect(response.body.transactions[0]).toHaveProperty("amount");
      expect(response.body.transactions[0]).toHaveProperty("direction");
      expect(response.body).toHaveProperty("pagination");
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get(`/api/v1/transactions?walletId=${wallet1Id}&limit=1&offset=0`)
        .expect(200);

      expect(response.body.transactions.length).toBe(1);
      expect(response.body).toHaveProperty("pagination");
      expect(response.body.pagination).toHaveProperty("limit");
      expect(response.body.pagination).toHaveProperty("offset");
    });

    it("should return empty array for wallet with no transactions", async () => {
      const response = await request(app)
        .get(`/api/v1/transactions?walletId=${wallet2Id}`)
        .expect(200);

      expect(response.body.transactions).toEqual([]);
    });

    it("should return 400 for missing walletId", async () => {
      const response = await request(app)
        .get("/api/v1/transactions")
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });
});
