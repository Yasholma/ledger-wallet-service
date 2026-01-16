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
 */
export const positiveIntegerSchema = z.coerce
  .number()
  .int("Amount must be an integer")
  .positive("Amount must be a positive integer");

/**
 * Validate non-empty string
 */
export const nonEmptyStringSchema = z.string().min(1, "String cannot be empty");
