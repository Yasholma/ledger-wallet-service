import { pool } from "../config/database";
import { User, CreateUserInput } from "../models/User";
import { Wallet } from "../models/Wallet";
import { LedgerService, ledgerService } from "./LedgerService";
import { UserNotFoundError, DuplicateEmailError } from "../utils/errors";
import { logger } from "../utils/logger";

export class WalletService {
  constructor(private ledgerService: LedgerService) {}

  async createUser(
    input: CreateUserInput
  ): Promise<{ user: User; wallet: Wallet }> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const userResult = await client.query(
        `INSERT INTO users (id, email, name)
        VALUES (gen_random_uuid(), $1, $2)
        RETURNING *`,
        [input.email, input.name]
      );

      const user = this.mapRowToUser(userResult.rows[0]);

      const walletResult = await client.query(
        `INSERT INTO wallets (id, user_id)
        VALUES (gen_random_uuid(), $1)
        RETURNING *`,
        [user.id]
      );

      const wallet = this.mapRowToWallet(walletResult.rows[0]);

      await client.query("COMMIT");

      logger.info("User and wallet created", {
        userId: user.id,
        walletId: wallet.id,
        email: user.email,
      });

      return { user, wallet };
    } catch (error: any) {
      await client.query("ROLLBACK");

      if (error?.code === "23505") {
        if (
          error?.constraint?.includes("email") ||
          error?.message?.includes("email") ||
          error?.message?.includes("unique constraint")
        ) {
          throw new DuplicateEmailError(input.email);
        }
      }

      throw error;
    } finally {
      client.release();
    }
  }

  async getUser(userId: string): Promise<User | null> {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToUser(result.rows[0]);
  }

  async getWalletByUserId(userId: string): Promise<Wallet | null> {
    const result = await pool.query(
      "SELECT * FROM wallets WHERE user_id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToWallet(result.rows[0]);
  }

  async getBalance(walletId: string): Promise<number> {
    const walletCheck = await pool.query(
      "SELECT id FROM wallets WHERE id = $1",
      [walletId]
    );

    if (walletCheck.rows.length === 0) {
      throw new UserNotFoundError(walletId);
    }

    return this.ledgerService.getBalance(walletId);
  }

  async getWallet(walletId: string): Promise<Wallet | null> {
    const result = await pool.query("SELECT * FROM wallets WHERE id = $1", [
      walletId,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToWallet(result.rows[0]);
  }

  async getAllUsersWithWallets(): Promise<
    Array<{ user: User; wallet: Wallet }>
  > {
    const result = await pool.query(
      `SELECT 
        u.id as user_id,
        u.email,
        u.name,
        u.created_at as user_created_at,
        w.id as wallet_id,
        w.user_id as wallet_user_id,
        w.created_at as wallet_created_at
      FROM users u
      INNER JOIN wallets w ON u.id = w.user_id
      ORDER BY u.created_at DESC`
    );

    return result.rows.map((row) => ({
      user: {
        id: row.user_id,
        email: row.email,
        name: row.name,
        created_at: row.user_created_at,
      },
      wallet: {
        id: row.wallet_id,
        user_id: row.wallet_user_id,
        created_at: row.wallet_created_at,
      },
    }));
  }

  private mapRowToUser(row: Record<string, any>): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      created_at: row.created_at,
    };
  }

  private mapRowToWallet(row: Record<string, any>): Wallet {
    return {
      id: row.id,
      user_id: row.user_id,
      created_at: row.created_at,
    };
  }
}

export const walletService = new WalletService(ledgerService);
