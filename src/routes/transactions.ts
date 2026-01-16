import { Router, Request, Response, NextFunction } from "express";
import { fundingService } from "../services/FundingService";
import { transferService } from "../services/TransferService";
import { ledgerService } from "../services/LedgerService";
import {
  validate,
  uuidSchema,
  positiveIntegerSchema,
  nonEmptyStringSchema,
} from "../middleware/validation";
import { idempotencyMiddleware } from "../middleware/idempotency";
import { z } from "zod";
import { logger, createRequestId } from "../utils/logger";

const router = Router();

const fundWalletSchema = {
  body: z.object({
    walletId: uuidSchema,
    amount: positiveIntegerSchema,
    externalPaymentRef: nonEmptyStringSchema,
  }),
};

const transferSchema = {
  body: z
    .object({
      senderWalletId: uuidSchema,
      receiverWalletId: uuidSchema,
      amount: positiveIntegerSchema,
    })
    .refine((data) => data.senderWalletId !== data.receiverWalletId, {
      message: "Cannot transfer funds from a wallet to itself",
      path: ["receiverWalletId"],
    }),
};

const getTransactionsSchema = {
  query: z.object({
    walletId: uuidSchema.optional(),
    limit: z.coerce.number().int().positive().max(100).optional().default(50),
    offset: z.coerce.number().int().nonnegative().optional().default(0),
  }),
};

/**
 * POST /transactions/fund
 * Fund a wallet via external payment reference
 * Requires Idempotency-Key header
 */
router.post(
  "/fund",
  idempotencyMiddleware,
  validate(fundWalletSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const requestId = createRequestId();
    logger.info("Funding wallet", {
      requestId,
      walletId: req.body.walletId,
      amount: req.body.amount,
      externalPaymentRef: req.body.externalPaymentRef,
    });

    try {
      const entry = await fundingService.fundWallet(req.body);

      res.status(201).json({
        transaction: {
          id: entry.id,
          wallet_id: entry.wallet_id,
          amount: entry.amount,
          direction: entry.direction,
          transaction_reference: entry.transaction_reference,
          external_payment_ref: entry.external_payment_ref,
          created_at: entry.created_at,
        },
      });
    } catch (error) {
      logger.error("Failed to fund wallet", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

/**
 * POST /transactions/transfer
 * Transfer funds between two wallets
 * Requires Idempotency-Key header
 */
router.post(
  "/transfer",
  idempotencyMiddleware,
  validate(transferSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = createRequestId();
    logger.info("Initiating transfer", {
      correlationId,
      senderWalletId: req.body.senderWalletId,
      receiverWalletId: req.body.receiverWalletId,
      amount: req.body.amount,
    });

    try {
      const transfer = await transferService.transfer({
        sender_wallet_id: req.body.senderWalletId,
        receiver_wallet_id: req.body.receiverWalletId,
        amount: req.body.amount,
      });

      res.status(201).json({
        transfer: {
          id: transfer.id,
          sender_wallet_id: transfer.sender_wallet_id,
          receiver_wallet_id: transfer.receiver_wallet_id,
          amount: transfer.amount,
          status: transfer.status,
          created_at: transfer.created_at,
        },
      });
    } catch (error) {
      logger.error("Transfer failed", {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

/**
 * GET /transactions
 * Get transaction history for a wallet
 */
router.get(
  "/",
  validate(getTransactionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = createRequestId();
    const { walletId, limit, offset } = req.query;

    logger.info("Getting transactions", {
      correlationId,
      walletId,
      limit,
      offset,
    });

    try {
      if (!walletId) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "walletId query parameter is required",
        });
      }

      // TypeScript doesn't know that Zod validation coerced these to numbers
      const limitNum = typeof limit === "number" ? limit : Number(limit) || 50;
      const offsetNum =
        typeof offset === "number" ? offset : Number(offset) || 0;

      const entries = await ledgerService.getEntries(
        walletId as string,
        limitNum,
        offsetNum
      );

      res.json({
        transactions: entries.map((entry) => ({
          id: entry.id,
          wallet_id: entry.wallet_id,
          amount: entry.amount,
          direction: entry.direction,
          transaction_reference: entry.transaction_reference,
          transfer_id: entry.transfer_id,
          external_payment_ref: entry.external_payment_ref,
          created_at: entry.created_at,
        })),
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          count: entries.length,
        },
      });
    } catch (error) {
      logger.error("Failed to get transactions", {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

export default router;
