import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";
import { logger } from "../utils/logger";

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Handle known application errors first
  if (err instanceof AppError) {
    logger.error("Request error", {
      error: err.message,
      code: err.code,
      path: req.path,
      method: req.method,
      statusCode: err.statusCode,
    });

    return res.status(err.statusCode).json({
      error: err.code || "APPLICATION_ERROR",
      message: err.message,
    });
  }

  // Handle validation errors (from Zod)
  if (err.name === "ZodError") {
    logger.error("Validation error", {
      error: err.message,
      path: req.path,
      method: req.method,
    });

    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: err.message,
    });
  }

  // Log unexpected errors with full details
  logger.error("Request error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    statusCode: 500,
  });

  // Handle unknown errors
  return res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message:
      process.env.NODE_ENV === "production"
        ? "An internal server error occurred"
        : err.message,
  });
}
