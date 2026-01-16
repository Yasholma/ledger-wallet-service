import { pool } from "../config/database";
import { IdempotencyKey } from "../models/IdempotencyKey";
import { IdempotencyKeyConflictError } from "../utils/errors";
import { logger } from "../utils/logger";
import crypto from "crypto";

export class IdempotencyService {
  private readonly ttlHours: number;

  constructor() {
    this.ttlHours = parseInt(process.env.IDEMPOTENCY_KEY_TTL || "24", 10);
  }

  hashRequest(body: any): string {
    const normalized = JSON.stringify(body, Object.keys(body).sort());
    return crypto.createHash("sha256").update(normalized).digest("hex");
  }

  async getKey(key: string): Promise<IdempotencyKey | null> {
    const result = await pool.query(
      `SELECT * FROM idempotency_keys
      WHERE key = $1 AND expires_at > NOW()`,
      [key]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToIdempotencyKey(result.rows[0]);
  }

  async storeKey(
    key: string,
    requestHash: string,
    responseStatus: number,
    responseBody: any
  ): Promise<IdempotencyKey> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.ttlHours);

    const result = await pool.query(
      `INSERT INTO idempotency_keys 
        (key, request_hash, response_status, response_body, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (key) DO UPDATE SET
        key = EXCLUDED.key
      RETURNING *`,
      [
        key,
        requestHash,
        responseStatus,
        JSON.stringify(responseBody),
        expiresAt,
      ]
    );

    const storedKey = this.mapRowToIdempotencyKey(result.rows[0]);

    if (storedKey.request_hash !== requestHash) {
      logger.warn("Idempotency key conflict detected", {
        key,
        storedHash: storedKey.request_hash,
        requestHash,
      });
      throw new IdempotencyKeyConflictError();
    }

    return storedKey;
  }

  async checkAndGetResponse(
    key: string,
    requestHash: string
  ): Promise<{ status: number; body: any } | null> {
    const existingKey = await this.getKey(key);

    if (!existingKey) {
      return null;
    }

    if (existingKey.request_hash !== requestHash) {
      logger.warn("Idempotency key request hash mismatch", {
        key,
        storedHash: existingKey.request_hash,
        requestHash,
      });
      throw new IdempotencyKeyConflictError();
    }

    logger.info("Idempotency key hit - returning cached response", { key });

    return {
      status: existingKey.response_status,
      body: existingKey.response_body,
    };
  }

  /**
   * Cleanup expired idempotency keys
   * Should be run periodically (e.g., via cron job)
   */
  async cleanupExpiredKeys(): Promise<number> {
    const result = await pool.query(
      `DELETE FROM idempotency_keys
      WHERE expires_at <= NOW()
      RETURNING key`
    );

    const deletedCount = result.rows.length;
    if (deletedCount > 0) {
      logger.info("Cleaned up expired idempotency keys", {
        count: deletedCount,
      });
    }

    return deletedCount;
  }

  private mapRowToIdempotencyKey(row: Record<string, any>): IdempotencyKey {
    return {
      key: row.key,
      request_hash: row.request_hash,
      response_status: row.response_status,
      response_body:
        typeof row.response_body === "string"
          ? JSON.parse(row.response_body)
          : row.response_body,
      created_at: row.created_at,
      expires_at: row.expires_at,
    };
  }
}

export const idempotencyService = new IdempotencyService();
