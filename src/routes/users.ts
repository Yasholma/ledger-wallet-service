import { Router, Request, Response, NextFunction } from "express";
import { walletService } from "../services/WalletService";
import { validate, emailSchema, nameSchema } from "../middleware/validation";
import { z } from "zod";
import { logger, createRequestId } from "../utils/logger";

const router = Router();

const createUserSchema = {
  body: z.object({
    email: emailSchema,
    name: nameSchema,
  }),
};

/**
 * POST /users
 * Create a new user and associated wallet
 */
router.post(
  "/",
  validate(createUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = createRequestId();
    logger.info("Creating user", {
      correlationId,
      email: req.body.email,
    });

    try {
      const { user, wallet } = await walletService.createUser(req.body);

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at,
        },
        wallet: {
          id: wallet.id,
          user_id: wallet.user_id,
          created_at: wallet.created_at,
        },
      });
    } catch (error) {
      logger.error("Failed to create user", {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

export default router;
