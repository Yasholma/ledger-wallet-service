// API Types
export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  created_at: string;
}

export interface CreateUserResponse {
  user: User;
  wallet: Wallet;
}

export interface BalanceResponse {
  wallet_id: string;
  user_id: string;
  balance: number;
  email?: string;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  amount: number;
  direction: "credit" | "debit";
  transaction_reference: string;
  transfer_id: string | null;
  external_payment_ref: string | null;
  created_at: string;
}

export interface FundWalletResponse {
  transaction: Transaction;
}

export interface Transfer {
  id: string;
  sender_wallet_id: string;
  receiver_wallet_id: string;
  amount: number;
  status: "pending" | "completed" | "failed";
  created_at: string;
}

export interface TransferResponse {
  transfer: Transfer;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  pagination: {
    limit: number;
    offset: number;
    total?: number;
  };
}

export interface UserWithWallet {
  id: string;
  email: string;
  name: string;
  wallet_id: string;
  created_at: string;
}

export interface UsersResponse {
  users: UserWithWallet[];
}

export interface ApiError {
  error: string;
  message: string;
}

// API Client
const API_BASE_URL = import.meta.env.PROD ? "" : "http://localhost:3000";

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as ApiError;
    throw new Error(error.message || error.error || "An error occurred");
  }

  return data as T;
}

// Generate UUID for idempotency keys
function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

export const api = {
  /**
   * Get all users with their wallet IDs
   */
  async getUsers(): Promise<UsersResponse> {
    return request<UsersResponse>("/api/v1/users");
  },

  /**
   * Create a new user and wallet
   */
  async createUser(email: string, name: string): Promise<CreateUserResponse> {
    return request<CreateUserResponse>("/api/v1/users", {
      method: "POST",
      body: JSON.stringify({ email, name }),
    });
  },

  /**
   * Get wallet balance for a user by user ID
   */
  async getBalance(userId: string): Promise<BalanceResponse> {
    return request<BalanceResponse>(`/api/v1/wallets/${userId}/balance`);
  },

  /**
   * Get wallet balance for a user by email
   */
  async getBalanceByEmail(email: string): Promise<BalanceResponse> {
    return request<BalanceResponse>(
      `/api/v1/wallets/balance/by-email/${encodeURIComponent(email)}`
    );
  },

  /**
   * Fund a wallet
   */
  async fundWallet(
    walletId: string,
    amount: number,
    externalPaymentRef: string
  ): Promise<FundWalletResponse> {
    const idempotencyKey = generateIdempotencyKey();
    return request<FundWalletResponse>("/api/v1/transactions/fund", {
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        walletId,
        amount,
        externalPaymentRef,
      }),
    });
  },

  /**
   * Transfer funds between wallets
   */
  async transferFunds(
    senderWalletId: string,
    receiverWalletId: string,
    amount: number
  ): Promise<TransferResponse> {
    const idempotencyKey = generateIdempotencyKey();
    return request<TransferResponse>("/api/v1/transactions/transfer", {
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        senderWalletId,
        receiverWalletId,
        amount,
      }),
    });
  },

  /**
   * Get transaction history for a wallet
   */
  async getTransactions(
    walletId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<TransactionsResponse> {
    const params = new URLSearchParams({
      walletId,
      limit: limit.toString(),
      offset: offset.toString(),
    });
    return request<TransactionsResponse>(`/api/v1/transactions?${params}`);
  },
};
