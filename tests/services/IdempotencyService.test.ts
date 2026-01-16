import { IdempotencyService } from "../../src/services/IdempotencyService";
import { pool } from "../../src/config/database";
import { IdempotencyKeyConflictError } from "../../src/utils/errors";
import crypto from "crypto";

jest.mock("../../src/config/database");

describe("IdempotencyService", () => {
  let idempotencyService: IdempotencyService;
  const mockPool = pool as any;

  beforeEach(() => {
    jest.clearAllMocks();
    idempotencyService = new IdempotencyService();
  });

  describe("hashRequest", () => {
    it("should generate consistent hash for same request", () => {
      const body = { walletId: "123", amount: 1000 };
      const hash1 = idempotencyService.hashRequest(body);
      const hash2 = idempotencyService.hashRequest(body);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex string length
    });

    it("should generate different hash for different requests", () => {
      const body1 = { walletId: "123", amount: 1000 };
      const body2 = { walletId: "123", amount: 2000 };

      const hash1 = idempotencyService.hashRequest(body1);
      const hash2 = idempotencyService.hashRequest(body2);

      expect(hash1).not.toBe(hash2);
    });

    it("should be order-independent (same keys, different order)", () => {
      const body1 = { walletId: "123", amount: 1000 };
      const body2 = { amount: 1000, walletId: "123" };

      const hash1 = idempotencyService.hashRequest(body1);
      const hash2 = idempotencyService.hashRequest(body2);

      expect(hash1).toBe(hash2);
    });
  });

  describe("checkAndGetResponse", () => {
    it("should return cached response if key exists and hash matches", async () => {
      const key = "test-key";
      const requestHash = "abc123";
      const mockKey = {
        key,
        request_hash: requestHash,
        response_status: 201,
        response_body: { id: "123" },
        created_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockKey],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      } as any);

      const result = await idempotencyService.checkAndGetResponse(
        key,
        requestHash
      );

      expect(result).not.toBeNull();
      expect(result?.status).toBe(201);
      expect(result?.body).toEqual({ id: "123" });
    });

    it("should throw IdempotencyKeyConflictError if hash does not match", async () => {
      const key = "test-key";
      const requestHash = "abc123";
      const storedHash = "different-hash";
      const mockKey = {
        key,
        request_hash: storedHash,
        response_status: 201,
        response_body: { id: "123" },
        created_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockKey],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      } as any);

      await expect(
        idempotencyService.checkAndGetResponse(key, requestHash)
      ).rejects.toThrow(IdempotencyKeyConflictError);
    });

    it("should return null if key does not exist", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      } as any);

      const result = await idempotencyService.checkAndGetResponse(
        "non-existent",
        "hash"
      );

      expect(result).toBeNull();
    });

    it("should return null if key is expired", async () => {
      const expiredKey = {
        key: "expired-key",
        request_hash: "hash",
        response_status: 201,
        response_body: { id: "123" },
        created_at: new Date(Date.now() - 48 * 60 * 60 * 1000),
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [], // Query filters out expired keys
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const result = await idempotencyService.checkAndGetResponse(
        "expired-key",
        "hash"
      );

      expect(result).toBeNull();
    });
  });

  describe("storeKey", () => {
    it("should store idempotency key successfully", async () => {
      const key = "test-key";
      const requestHash = "abc123";
      const responseStatus = 201;
      const responseBody = { id: "123" };

      const mockStoredKey = {
        key,
        request_hash: requestHash,
        response_status: responseStatus,
        response_body: JSON.stringify(responseBody),
        created_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockStoredKey],
        rowCount: 1,
        command: "INSERT",
        oid: 0,
        fields: [],
      });

      const stored = await idempotencyService.storeKey(
        key,
        requestHash,
        responseStatus,
        responseBody
      );

      expect(stored.key).toBe(key);
      expect(stored.request_hash).toBe(requestHash);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO idempotency_keys"),
        expect.arrayContaining([key, requestHash, responseStatus])
      );
    });

    it("should throw IdempotencyKeyConflictError if key exists with different hash", async () => {
      const key = "test-key";
      const requestHash = "new-hash";
      const storedHash = "old-hash";

      const mockExistingKey = {
        key,
        request_hash: storedHash,
        response_status: 201,
        response_body: JSON.stringify({ id: "123" }),
        created_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockExistingKey],
        rowCount: 1,
        command: "INSERT",
        oid: 0,
        fields: [],
      });

      await expect(
        idempotencyService.storeKey(key, requestHash, 201, { id: "123" })
      ).rejects.toThrow(IdempotencyKeyConflictError);
    });
  });

  describe("cleanupExpiredKeys", () => {
    it("should delete expired keys", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ key: "expired-1" }, { key: "expired-2" }],
        rowCount: 2,
        command: "DELETE",
        oid: 0,
        fields: [],
      } as any);

      const deletedCount = await idempotencyService.cleanupExpiredKeys();

      expect(deletedCount).toBe(2);
      // Verify the DELETE query was called (with or without parameters)
      expect(mockPool.query).toHaveBeenCalled();
      const deleteCall = mockPool.query.mock.calls.find(
        (call: any) =>
          typeof call[0] === "string" &&
          call[0].includes("DELETE FROM idempotency_keys")
      );
      expect(deleteCall).toBeDefined();
      expect(deleteCall[0]).toContain("DELETE FROM idempotency_keys");
    });

    it("should return 0 if no expired keys", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "DELETE",
        oid: 0,
        fields: [],
      });

      const deletedCount = await idempotencyService.cleanupExpiredKeys();

      expect(deletedCount).toBe(0);
    });
  });
});
