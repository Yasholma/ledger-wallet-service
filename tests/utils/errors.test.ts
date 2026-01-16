import {
  AppError,
  InsufficientBalanceError,
  WalletNotFoundError,
  UserNotFoundError,
  DuplicateEmailError,
  DuplicatePaymentRefError,
  IdempotencyKeyConflictError,
  ValidationError,
} from '../../src/utils/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with default status code 500', () => {
      const error = new AppError('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Test error');
      expect(error.code).toBeUndefined();
    });

    it('should create error with custom status code and code', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
    });
  });

  describe('InsufficientBalanceError', () => {
    it('should have correct default message and status code', () => {
      const error = new InsufficientBalanceError();
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('INSUFFICIENT_BALANCE');
      expect(error.message).toBe('Insufficient balance');
    });

    it('should accept custom message', () => {
      const error = new InsufficientBalanceError('Custom message');
      expect(error.message).toBe('Custom message');
    });
  });

  describe('WalletNotFoundError', () => {
    it('should have correct status code and code', () => {
      const error = new WalletNotFoundError();
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('WALLET_NOT_FOUND');
    });

    it('should include wallet ID in message when provided', () => {
      const error = new WalletNotFoundError('wallet-123');
      expect(error.message).toContain('wallet-123');
    });
  });

  describe('UserNotFoundError', () => {
    it('should have correct status code and code', () => {
      const error = new UserNotFoundError();
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('USER_NOT_FOUND');
    });

    it('should include user ID in message when provided', () => {
      const error = new UserNotFoundError('user-123');
      expect(error.message).toContain('user-123');
    });
  });

  describe('DuplicateEmailError', () => {
    it('should have correct status code and code', () => {
      const error = new DuplicateEmailError('test@example.com');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('DUPLICATE_EMAIL');
      expect(error.message).toContain('test@example.com');
    });
  });

  describe('DuplicatePaymentRefError', () => {
    it('should have correct status code and code', () => {
      const error = new DuplicatePaymentRefError('payment-123');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('DUPLICATE_PAYMENT_REF');
      expect(error.message).toContain('payment-123');
    });
  });

  describe('IdempotencyKeyConflictError', () => {
    it('should have correct status code and code', () => {
      const error = new IdempotencyKeyConflictError();
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
    });
  });

  describe('ValidationError', () => {
    it('should have correct status code and code', () => {
      const error = new ValidationError('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input');
    });
  });
});
