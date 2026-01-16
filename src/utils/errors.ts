export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(message: string = "Insufficient balance") {
    super(message, 400, "INSUFFICIENT_BALANCE");
  }
}

export class WalletNotFoundError extends AppError {
  constructor(walletId?: string) {
    super(
      walletId ? `Wallet ${walletId} not found` : "Wallet not found",
      404,
      "WALLET_NOT_FOUND"
    );
  }
}

export class UserNotFoundError extends AppError {
  constructor(userId?: string) {
    super(
      userId ? `User ${userId} not found` : "User not found",
      404,
      "USER_NOT_FOUND"
    );
  }
}

export class DuplicateEmailError extends AppError {
  constructor(email: string) {
    super(`User with email ${email} already exists`, 409, "DUPLICATE_EMAIL");
  }
}

export class DuplicatePaymentRefError extends AppError {
  constructor(paymentRef: string) {
    super(
      `External payment reference ${paymentRef} already exists`,
      409,
      "DUPLICATE_PAYMENT_REF"
    );
  }
}

export class IdempotencyKeyConflictError extends AppError {
  constructor() {
    super(
      "Idempotency key exists but request does not match",
      409,
      "IDEMPOTENCY_KEY_CONFLICT"
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}
