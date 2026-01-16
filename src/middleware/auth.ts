import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

/**
 * Authentication middleware placeholder
 * 
 * In a production system, this would:
 * 1. Extract JWT token from Authorization header (Bearer <token>)
 * 2. Verify token signature using a secret key
 * 3. Check token expiration
 * 4. Extract user information from token payload
 * 5. Attach user info to req.user for downstream handlers
 * 
 * Example implementation:
 * 
 * import jwt from 'jsonwebtoken';
 * 
 * export function authenticate(req: Request, res: Response, next: NextFunction) {
 *   const authHeader = req.headers.authorization;
 *   
 *   if (!authHeader || !authHeader.startsWith('Bearer ')) {
 *     throw new AppError('Missing or invalid authorization header', 401, 'UNAUTHORIZED');
 *   }
 * 
 *   const token = authHeader.substring(7);
 *   
 *   try {
 *     const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
 *     req.user = { userId: decoded.userId };
 *     next();
 *   } catch (error) {
 *     throw new AppError('Invalid or expired token', 401, 'UNAUTHORIZED');
 *   }
 * }
 * 
 * To use: app.use('/transactions', authenticate, transactionsRouter);
 */

export function authenticate(req: Request, res: Response, next: NextFunction) {
  // Placeholder: In production, implement JWT verification here
  // For now, this middleware is a no-op but demonstrates where auth would be added
  
  // Example: Uncomment to require authentication
  // const authHeader = req.headers.authorization;
  // if (!authHeader) {
  //   throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  // }
  
  next();
}
