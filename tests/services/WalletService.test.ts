import { WalletService } from "../../src/services/WalletService";
import { LedgerService } from "../../src/services/LedgerService";
import { pool } from "../../src/config/database";
import { DuplicateEmailError, UserNotFoundError } from "../../src/utils/errors";

jest.mock("../../src/config/database");
jest.mock("../../src/services/LedgerService");

describe("WalletService", () => {
  let walletService: WalletService;
  let mockLedgerService: jest.Mocked<LedgerService>;
  const mockPool = pool as any;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    mockPool.connect = jest.fn().mockResolvedValue(mockClient);
    mockPool.query = jest.fn();

    mockLedgerService = {
      getBalance: jest.fn(),
    } as any;

    walletService = new WalletService(mockLedgerService);
  });

  describe("createUser", () => {
    const createUserInput = {
      email: "user@example.com",
      name: "John Doe",
    };

    it("should create user and wallet successfully", async () => {
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        name: "John Doe",
        created_at: new Date("2024-01-01"),
      };

      const mockWallet = {
        id: "wallet-123",
        user_id: "user-123",
        created_at: new Date("2024-01-01"),
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [mockUser] }) // INSERT INTO users
        .mockResolvedValueOnce({ rows: [mockWallet] }) // INSERT INTO wallets
        .mockResolvedValueOnce({}); // COMMIT

      const result = await walletService.createUser(createUserInput);

      expect(result.user).toEqual({
        id: "user-123",
        email: "user@example.com",
        name: "John Doe",
        created_at: mockUser.created_at,
      });
      expect(result.wallet).toEqual({
        id: "wallet-123",
        user_id: "user-123",
        created_at: mockWallet.created_at,
      });
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should throw DuplicateEmailError when email already exists", async () => {
      const duplicateError = {
        code: "23505",
        constraint: "users_email_key",
        message:
          'duplicate key value violates unique constraint "users_email_key"',
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(duplicateError); // INSERT INTO users fails

      await expect(walletService.createUser(createUserInput)).rejects.toThrow(
        DuplicateEmailError
      );

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should throw DuplicateEmailError when error message contains email", async () => {
      const duplicateError = {
        code: "23505",
        message: "duplicate email",
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(duplicateError); // INSERT INTO users fails

      await expect(walletService.createUser(createUserInput)).rejects.toThrow(
        DuplicateEmailError
      );

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    it("should throw DuplicateEmailError when error message contains unique constraint", async () => {
      const duplicateError = {
        code: "23505",
        message: "unique constraint violation",
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(duplicateError); // INSERT INTO users fails

      await expect(walletService.createUser(createUserInput)).rejects.toThrow(
        DuplicateEmailError
      );

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    });

    it("should rollback and rethrow non-duplicate errors", async () => {
      const dbError = new Error("Database connection failed");

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(dbError); // INSERT INTO users fails

      await expect(walletService.createUser(createUserInput)).rejects.toThrow(
        "Database connection failed"
      );

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("getUser", () => {
    it("should return user when found", async () => {
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        name: "John Doe",
        created_at: new Date("2024-01-01"),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockUser],
      });

      const user = await walletService.getUser("user-123");

      expect(user).toEqual({
        id: "user-123",
        email: "user@example.com",
        name: "John Doe",
        created_at: mockUser.created_at,
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = $1",
        ["user-123"]
      );
    });

    it("should return null when user not found", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      const user = await walletService.getUser("user-123");

      expect(user).toBeNull();
    });
  });

  describe("getUserByEmail", () => {
    it("should return user when found by email", async () => {
      const mockUser = {
        id: "user-123",
        email: "user@example.com",
        name: "John Doe",
        created_at: new Date("2024-01-01"),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockUser],
      });

      const user = await walletService.getUserByEmail("user@example.com");

      expect(user).toEqual({
        id: "user-123",
        email: "user@example.com",
        name: "John Doe",
        created_at: mockUser.created_at,
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE email = $1",
        ["user@example.com"]
      );
    });

    it("should return null when user not found by email", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      const user = await walletService.getUserByEmail("user@example.com");

      expect(user).toBeNull();
    });
  });

  describe("getWalletByUserId", () => {
    it("should return wallet when found", async () => {
      const mockWallet = {
        id: "wallet-123",
        user_id: "user-123",
        created_at: new Date("2024-01-01"),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockWallet],
      });

      const wallet = await walletService.getWalletByUserId("user-123");

      expect(wallet).toEqual({
        id: "wallet-123",
        user_id: "user-123",
        created_at: mockWallet.created_at,
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM wallets WHERE user_id = $1",
        ["user-123"]
      );
    });

    it("should return null when wallet not found", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      const wallet = await walletService.getWalletByUserId("user-123");

      expect(wallet).toBeNull();
    });
  });

  describe("getBalance", () => {
    it("should return balance when wallet exists", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: "wallet-123" }],
      });

      mockLedgerService.getBalance.mockResolvedValueOnce(10000);

      const balance = await walletService.getBalance("wallet-123");

      expect(balance).toBe(10000);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT id FROM wallets WHERE id = $1",
        ["wallet-123"]
      );
      expect(mockLedgerService.getBalance).toHaveBeenCalledWith("wallet-123");
    });

    it("should throw UserNotFoundError when wallet does not exist", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      await expect(walletService.getBalance("wallet-123")).rejects.toThrow(
        UserNotFoundError
      );

      expect(mockLedgerService.getBalance).not.toHaveBeenCalled();
    });
  });

  describe("getWallet", () => {
    it("should return wallet when found", async () => {
      const mockWallet = {
        id: "wallet-123",
        user_id: "user-123",
        created_at: new Date("2024-01-01"),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockWallet],
      });

      const wallet = await walletService.getWallet("wallet-123");

      expect(wallet).toEqual({
        id: "wallet-123",
        user_id: "user-123",
        created_at: mockWallet.created_at,
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM wallets WHERE id = $1",
        ["wallet-123"]
      );
    });

    it("should return null when wallet not found", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      const wallet = await walletService.getWallet("wallet-123");

      expect(wallet).toBeNull();
    });
  });
});
