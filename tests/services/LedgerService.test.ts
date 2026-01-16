import { LedgerService } from "../../src/services/LedgerService";
import { pool } from "../../src/config/database";
import { WalletNotFoundError } from "../../src/utils/errors";

// Mock the database
jest.mock("../../src/config/database");

describe("LedgerService", () => {
  let ledgerService: LedgerService;
  const mockPool = pool as any;

  beforeEach(() => {
    jest.clearAllMocks();
    ledgerService = new LedgerService();
  });

  describe("getBalance", () => {
    it("should calculate balance correctly from credits and debits", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ balance: "15000" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      } as any);

      const balance = await ledgerService.getBalance("wallet-123");

      expect(balance).toBe(15000);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "SUM(amount) FILTER (WHERE direction = 'credit')"
        ),
        ["wallet-123"]
      );
    });

    it("should return 0 for wallet with no entries", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ balance: "0" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const balance = await ledgerService.getBalance("wallet-123");

      expect(balance).toBe(0);
    });

    it("should handle negative balances", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ balance: "-5000" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const balance = await ledgerService.getBalance("wallet-123");

      expect(balance).toBe(-5000);
    });
  });

  describe("createEntry", () => {
    const mockEntry = {
      id: "entry-123",
      wallet_id: "wallet-123",
      amount: "10000",
      direction: "credit",
      transaction_reference: "ref-123",
      transfer_id: null,
      external_payment_ref: null,
      created_at: new Date(),
    };

    it("should create a ledger entry successfully", async () => {
      // Mock wallet exists check
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: "wallet-123" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      // Mock entry creation
      mockPool.query.mockResolvedValueOnce({
        rows: [mockEntry],
        rowCount: 1,
        command: "INSERT",
        oid: 0,
        fields: [],
      } as any);

      const entry = await ledgerService.createEntry({
        wallet_id: "wallet-123",
        amount: 10000,
        direction: "credit",
        transaction_reference: "ref-123",
      });

      expect(entry.id).toBe("entry-123");
      expect(entry.amount).toBe(10000);
      expect(entry.direction).toBe("credit");
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it("should throw WalletNotFoundError if wallet does not exist", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      } as any);

      await expect(
        ledgerService.createEntry({
          wallet_id: "non-existent",
          amount: 10000,
          direction: "credit",
          transaction_reference: "ref-123",
        })
      ).rejects.toThrow(WalletNotFoundError);
    });

    it("should create entry with transfer_id when provided", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: "wallet-123" }],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [{ ...mockEntry, transfer_id: "transfer-123" }],
        rowCount: 1,
        command: "INSERT",
        oid: 0,
        fields: [],
      });

      const entry = await ledgerService.createEntry({
        wallet_id: "wallet-123",
        amount: 10000,
        direction: "debit",
        transaction_reference: "ref-123",
        transfer_id: "transfer-123",
      });

      expect(entry.transfer_id).toBe("transfer-123");
    });
  });

  describe("getEntries", () => {
    it("should return paginated ledger entries", async () => {
      const mockEntries = [
        {
          id: "entry-1",
          wallet_id: "wallet-123",
          amount: "10000",
          direction: "credit",
          transaction_reference: "ref-1",
          transfer_id: null,
          external_payment_ref: null,
          created_at: new Date(),
        },
        {
          id: "entry-2",
          wallet_id: "wallet-123",
          amount: "5000",
          direction: "debit",
          transaction_reference: "ref-2",
          transfer_id: "transfer-123",
          external_payment_ref: null,
          created_at: new Date(),
        },
      ];

      mockPool.query.mockResolvedValueOnce({
        rows: mockEntries,
        rowCount: 2,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const entries = await ledgerService.getEntries("wallet-123", 50, 0);

      expect(entries).toHaveLength(2);
      expect(entries[0].amount).toBe(10000);
      expect(entries[1].amount).toBe(5000);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY created_at DESC"),
        ["wallet-123", 50, 0]
      );
    });
  });

  describe("findEntryByExternalPaymentRef", () => {
    it("should return entry if external payment ref exists", async () => {
      const mockEntry = {
        id: "entry-123",
        wallet_id: "wallet-123",
        amount: "10000",
        direction: "credit",
        transaction_reference: "ref-123",
        transfer_id: null,
        external_payment_ref: "payment-123",
        created_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockEntry],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      });

      const entry = await ledgerService.findEntryByExternalPaymentRef(
        "payment-123"
      );

      expect(entry).not.toBeNull();
      expect(entry?.external_payment_ref).toBe("payment-123");
    });

    it("should return null if external payment ref does not exist", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      } as any);

      const entry = await ledgerService.findEntryByExternalPaymentRef(
        "non-existent"
      );

      expect(entry).toBeNull();
    });
  });
});
