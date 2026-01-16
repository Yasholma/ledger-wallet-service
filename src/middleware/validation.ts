import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { ValidationError } from "../utils/errors";

/**
 * Validation middleware factory
 * Creates middleware that validates request body/params/query against a Zod schema
 */
export function validate(schema: {
  body?: z.ZodSchema;
  params?: z.ZodSchema;
  query?: z.ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }
      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const messages = error.errors.map(
          (err: z.ZodIssue) => `${err.path.join(".")}: ${err.message}`
        );
        throw new ValidationError(`Validation failed: ${messages.join(", ")}`);
      }
      next(error as Error);
    }
  };
}

/**
 * Validate UUID format
 */
export const uuidSchema = z.string().uuid();

/**
 * Validate positive integer (for amounts)
 * Coerces string numbers to numbers for JSON compatibility
 * Maximum amount: 1,000,000,000,000 (10 billion dollars in cents)
 */
export const positiveIntegerSchema = z.coerce
  .number()
  .int("Amount must be an integer")
  .positive("Amount must be a positive integer")
  .max(1_000_000_000_000, "Amount exceeds maximum allowed value");

/**
 * Validate non-empty string
 */
export const nonEmptyStringSchema = z.string().min(1, "String cannot be empty");

/**
 * Validate email with length constraint
 */
export const emailSchema = z
  .string()
  .email("Invalid email format")
  .max(255, "Email must not exceed 255 characters");

/**
 * Validate name with length constraint
 */
export const nameSchema = z
  .string()
  .min(1, "Name cannot be empty")
  .max(255, "Name must not exceed 255 characters");

/**
 * Validate external payment reference with length constraint
 */
export const externalPaymentRefSchema = z
  .string()
  .min(1, "External payment reference cannot be empty")
  .max(255, "External payment reference must not exceed 255 characters");

/**
 * Validate idempotency key with length constraint
 */
export const idempotencyKeySchema = z
  .string()
  .min(1, "Idempotency key cannot be empty")
  .max(255, "Idempotency key must not exceed 255 characters");
