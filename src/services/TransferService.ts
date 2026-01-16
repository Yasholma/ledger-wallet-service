import { pool } from "../config/database";
import { Transfer, CreateTransferInput } from "../models/Transfer";
import { LedgerService, ledgerService } from "./LedgerService";
import { InsufficientBalanceError, WalletNotFoundError } from "../utils/errors";
import { logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";

export class TransferService {
  constructor(private ledgerService: LedgerService) {}

  async transfer(input: CreateTransferInput): Promise<Transfer> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");

      // Sort wallet IDs to ensure consistent locking order (prevents deadlocks)
      const walletIds = [
        input.sender_wallet_id,
        input.receiver_wallet_id,
      ].sort();
      const [firstWalletId, secondWalletId] = walletIds;

      const wallet1Result = await client.query(
        "SELECT id FROM wallets WHERE id = $1 FOR UPDATE",
        [firstWalletId]
      );

      const wallet2Result = await client.query(
        "SELECT id FROM wallets WHERE id = $1 FOR UPDATE",
        [secondWalletId]
      );

      if (wallet1Result.rows.length === 0 || wallet2Result.rows.length === 0) {
        const missingWalletId =
          wallet1Result.rows.length === 0 ? firstWalletId : secondWalletId;
        throw new WalletNotFoundError(missingWalletId);
      }

      const balanceResult = await client.query(
        `SELECT 
          COALESCE(SUM(amount) FILTER (WHERE direction = 'credit'), 0) -
          COALESCE(SUM(amount) FILTER (WHERE direction = 'debit'), 0) as balance
        FROM ledger_entries
        WHERE wallet_id = $1`,
        [input.sender_wallet_id]
      );

      if (!balanceResult.rows[0] || balanceResult.rows[0].balance === null) {
        throw new InsufficientBalanceError(
          `Insufficient balance. Available: $0.00, Required: $${(input.amount / 100).toFixed(2)}`
        );
      }

      const balance = parseInt(balanceResult.rows[0].balance, 10);
      if (isNaN(balance)) {
        throw new InsufficientBalanceError(
          `Insufficient balance. Available: $0.00, Required: $${(input.amount / 100).toFixed(2)}`
        );
      }

      if (balance < input.amount) {
        const availableUSD = (balance / 100).toFixed(2);
        const requiredUSD = (input.amount / 100).toFixed(2);
        throw new InsufficientBalanceError(
          `Insufficient balance. Available: $${availableUSD}, Required: $${requiredUSD}`
        );
      }

      const transferId = uuidv4();
      const transactionReference = `transfer_${transferId}`;

      await client.query(
        `INSERT INTO transfers 
          (id, sender_wallet_id, receiver_wallet_id, amount, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING *`,
        [
          transferId,
          input.sender_wallet_id,
          input.receiver_wallet_id,
          input.amount,
        ]
      );

      // Create debit entry for sender
      await client.query(
        `INSERT INTO ledger_entries 
          (wallet_id, amount, direction, transaction_reference, transfer_id)
        VALUES ($1, $2, 'debit', $3, $4)`,
        [input.sender_wallet_id, input.amount, transactionReference, transferId]
      );

      // Create credit entry for receiver
      await client.query(
        `INSERT INTO ledger_entries 
          (wallet_id, amount, direction, transaction_reference, transfer_id)
        VALUES ($1, $2, 'credit', $3, $4)`,
        [
          input.receiver_wallet_id,
          input.amount,
          transactionReference,
          transferId,
        ]
      );

      await client.query(
        `UPDATE transfers SET status = 'completed' WHERE id = $1`,
        [transferId]
      );

      // Fetch the updated transfer to get the correct status (before commit, still in transaction)
      const updatedTransferResult = await client.query(
        "SELECT * FROM transfers WHERE id = $1",
        [transferId]
      );

      await client.query("COMMIT");

      const transfer = this.mapRowToTransfer(updatedTransferResult.rows[0]);

      logger.info("Transfer completed", {
        transferId: transfer.id,
        senderWalletId: transfer.sender_wallet_id,
        receiverWalletId: transfer.receiver_wallet_id,
        amount: transfer.amount,
      });

      return transfer;
    } catch (error) {
      await client.query("ROLLBACK");

      if (
        error instanceof InsufficientBalanceError ||
        error instanceof WalletNotFoundError
      ) {
        throw error;
      }

      logger.error("Transfer failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        input,
      });

      throw error;
    } finally {
      client.release();
    }
  }

  async getTransfer(transferId: string): Promise<Transfer | null> {
    const result = await pool.query("SELECT * FROM transfers WHERE id = $1", [
      transferId,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTransfer(result.rows[0]);
  }

  private mapRowToTransfer(row: Record<string, any>): Transfer {
    return {
      id: row.id,
      sender_wallet_id: row.sender_wallet_id,
      receiver_wallet_id: row.receiver_wallet_id,
      amount: parseInt(row.amount, 10),
      status: row.status,
      created_at: row.created_at,
    };
  }
}

export const transferService = new TransferService(ledgerService);
