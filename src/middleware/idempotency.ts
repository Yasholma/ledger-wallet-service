import { Request, Response, NextFunction } from 'express';
import { idempotencyService } from '../services/IdempotencyService';
import { IdempotencyKeyConflictError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Idempotency middleware
 * Checks for Idempotency-Key header and returns cached response if exists
 * Stores response for future requests with same key
 */
export function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const idempotencyKey = req.headers['idempotency-key'] as string;

  if (!idempotencyKey) {
    return next();
  }

  // Hash the request body for comparison
  const requestHash = idempotencyService.hashRequest(req.body);

  // Check if we have a cached response
  idempotencyService
    .checkAndGetResponse(idempotencyKey, requestHash)
    .then((cachedResponse) => {
      if (cachedResponse) {
        logger.info('Returning cached idempotent response', {
          idempotencyKey,
          path: req.path,
        });
        return res.status(cachedResponse.status).json(cachedResponse.body);
      }

      // No cached response, continue to handler
      // Store original json method to capture response
      const originalJson = res.json.bind(res);
      const originalStatus = res.status.bind(res);

      let responseStatus = 200;
      let responseBody: any = null;

      res.status = function (code: number) {
        responseStatus = code;
        return originalStatus(code);
      };

      res.json = function (body: any) {
        responseBody = body;

        // Store the response for future idempotent requests
        idempotencyService
          .storeKey(idempotencyKey, requestHash, responseStatus, responseBody)
          .catch((error) => {
            logger.error('Failed to store idempotency key', {
              error: error instanceof Error ? error.message : String(error),
              idempotencyKey,
            });
            // Don't fail the request if storing idempotency key fails
          });

        return originalJson(body);
      };

      next();
    })
    .catch((error) => {
      if (error instanceof IdempotencyKeyConflictError) {
        return res.status(409).json({
          error: 'IDEMPOTENCY_KEY_CONFLICT',
          message: 'Idempotency key exists but request does not match',
        });
      }

      logger.error('Idempotency middleware error', {
        error: error instanceof Error ? error.message : String(error),
        idempotencyKey,
      });

      next(error);
    });
}
