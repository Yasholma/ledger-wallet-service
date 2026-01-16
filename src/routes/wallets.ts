import { Router, Request, Response, NextFunction } from "express";
import { walletService } from "../services/WalletService";
import { validate, uuidSchema } from "../middleware/validation";
import { z } from "zod";
import { logger, createRequestId } from "../utils/logger";

const router = Router();

const getBalanceSchema = {
  params: z.object({
    userId: uuidSchema,
  }),
};

const getBalanceByEmailSchema = {
  params: z.object({
    email: z.string().email(),
  }),
};

/**
 * GET /wallets/balance/by-email/:email
 * Get wallet balance for a user by email
 * This route must come before /:userId/balance to avoid route conflicts
 */
router.get(
  "/balance/by-email/:email",
  validate(getBalanceByEmailSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = createRequestId();
    const { email } = req.params;

    logger.info("Getting wallet balance by email", {
      correlationId,
      email,
    });

    try {
      const user = await walletService.getUserByEmail(email);

      if (!user) {
        return res.status(404).json({
          error: "USER_NOT_FOUND",
          message: `User with email ${email} not found`,
        });
      }

      const wallet = await walletService.getWalletByUserId(user.id);

      if (!wallet) {
        return res.status(404).json({
          error: "WALLET_NOT_FOUND",
          message: `Wallet for user ${user.id} not found`,
        });
      }

      const balance = await walletService.getBalance(wallet.id);

      res.json({
        wallet_id: wallet.id,
        user_id: user.id,
        email: user.email,
        balance,
      });
    } catch (error) {
      logger.error("Failed to get balance by email", {
        correlationId,
        email,
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

/**
 * GET /wallets/:userId/balance
 * Get wallet balance for a user by user ID
 */
router.get(
  "/:userId/balance",
  validate(getBalanceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = createRequestId();
    const { userId } = req.params;

    logger.info("Getting wallet balance", {
      correlationId,
      userId,
    });

    try {
      const wallet = await walletService.getWalletByUserId(userId);

      if (!wallet) {
        return res.status(404).json({
          error: "WALLET_NOT_FOUND",
          message: `Wallet for user ${userId} not found`,
        });
      }

      const balance = await walletService.getBalance(wallet.id);

      res.json({
        wallet_id: wallet.id,
        user_id: userId,
        balance,
      });
    } catch (error) {
      logger.error("Failed to get balance", {
        correlationId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

export default router;
