import { pool } from "../config/database";
import {
  LedgerEntry,
  CreateLedgerEntryInput,
  LedgerDirection,
} from "../models/LedgerEntry";
import { WalletNotFoundError } from "../utils/errors";
import { logger } from "../utils/logger";

export class LedgerService {
  /**
   * Calculate wallet balance from ledger entries
   * Balance = SUM(credits) - SUM(debits)
   */
  async getBalance(walletId: string): Promise<number> {
    const result = await pool.query(
      `SELECT 
        COALESCE(SUM(amount) FILTER (WHERE direction = 'credit'), 0) -
        COALESCE(SUM(amount) FILTER (WHERE direction = 'debit'), 0) as balance
      FROM ledger_entries
      WHERE wallet_id = $1`,
      [walletId]
    );

    const balance = parseInt(result.rows[0].balance, 10);
    return balance;
  }

  async createEntry(input: CreateLedgerEntryInput): Promise<LedgerEntry> {
    const walletCheck = await pool.query(
      "SELECT id FROM wallets WHERE id = $1",
      [input.wallet_id]
    );

    if (walletCheck.rows.length === 0) {
      throw new WalletNotFoundError(input.wallet_id);
    }

    const result = await pool.query(
      `INSERT INTO ledger_entries 
        (wallet_id, amount, direction, transaction_reference, transfer_id, external_payment_ref)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        input.wallet_id,
        input.amount,
        input.direction,
        input.transaction_reference,
        input.transfer_id || null,
        input.external_payment_ref || null,
      ]
    );

    const entry = this.mapRowToLedgerEntry(result.rows[0]);

    logger.info("Ledger entry created", {
      entryId: entry.id,
      walletId: entry.wallet_id,
      amount: entry.amount,
      direction: entry.direction,
      transactionReference: entry.transaction_reference,
    });

    return entry;
  }

  async getEntries(
    walletId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<LedgerEntry[]> {
    const result = await pool.query(
      `SELECT * FROM ledger_entries
      WHERE wallet_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
      [walletId, limit, offset]
    );

    return result.rows.map((row: Record<string, any>) =>
      this.mapRowToLedgerEntry(row)
    );
  }

  async findEntryByExternalPaymentRef(
    externalPaymentRef: string
  ): Promise<LedgerEntry | null> {
    const result = await pool.query(
      `SELECT * FROM ledger_entries
      WHERE external_payment_ref = $1`,
      [externalPaymentRef]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToLedgerEntry(result.rows[0]);
  }

  async getEntriesByTransactionReference(
    transactionReference: string
  ): Promise<LedgerEntry[]> {
    const result = await pool.query(
      `SELECT * FROM ledger_entries
      WHERE transaction_reference = $1
      ORDER BY created_at ASC`,
      [transactionReference]
    );

    return result.rows.map((row: Record<string, any>) =>
      this.mapRowToLedgerEntry(row)
    );
  }

  private mapRowToLedgerEntry(row: Record<string, any>): LedgerEntry {
    return {
      id: row.id,
      wallet_id: row.wallet_id,
      amount: parseInt(row.amount, 10),
      direction: row.direction as LedgerDirection,
      transaction_reference: row.transaction_reference,
      transfer_id: row.transfer_id,
      external_payment_ref: row.external_payment_ref,
      created_at: row.created_at,
    };
  }
}

export const ledgerService = new LedgerService();
