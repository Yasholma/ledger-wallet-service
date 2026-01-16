import { TransferService } from '../../src/services/TransferService';
import { LedgerService } from '../../src/services/LedgerService';
import { pool } from '../../src/config/database';
import { InsufficientBalanceError, WalletNotFoundError } from '../../src/utils/errors';

jest.mock('../../src/config/database');

describe('TransferService', () => {
  let transferService: TransferService;
  let mockLedgerService: jest.Mocked<LedgerService>;
  const mockPool = pool as any;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLedgerService = {
      getBalance: jest.fn(),
      createEntry: jest.fn(),
      getEntries: jest.fn(),
      findEntryByExternalPaymentRef: jest.fn(),
      getEntriesByTransactionReference: jest.fn(),
    } as any;

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    mockPool.connect.mockResolvedValue(mockClient);
    transferService = new TransferService(mockLedgerService);
  });

  describe('transfer', () => {
    const transferInput = {
      sender_wallet_id: 'wallet-1',
      receiver_wallet_id: 'wallet-2',
      amount: 5000,
    };

    it('should perform atomic transfer successfully', async () => {
      // Mock transaction setup
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET TRANSACTION ISOLATION LEVEL
        .mockResolvedValueOnce({ rows: [{ id: 'wallet-1' }] }) // Lock wallet-1
        .mockResolvedValueOnce({ rows: [{ id: 'wallet-2' }] }) // Lock wallet-2
        .mockResolvedValueOnce({ rows: [{ balance: '10000' }] }) // Balance check
        .mockResolvedValueOnce({
          rows: [{
            id: 'transfer-123',
            sender_wallet_id: 'wallet-1',
            receiver_wallet_id: 'wallet-2',
            amount: '5000',
            status: 'pending',
            created_at: new Date(),
          }],
        }) // Create transfer
        .mockResolvedValueOnce({}) // Create debit entry
        .mockResolvedValueOnce({}) // Create credit entry
        .mockResolvedValueOnce({}) // Update transfer status
        .mockResolvedValueOnce({ rows: [{ // SELECT transfer after update
          id: 'transfer-123',
          sender_wallet_id: 'wallet-1',
          receiver_wallet_id: 'wallet-2',
          amount: '5000',
          status: 'completed',
          created_at: new Date(),
        }] })
        .mockResolvedValueOnce({}); // COMMIT

      const transfer = await transferService.transfer(transferInput);

      expect(transfer.id).toBe('transfer-123');
      expect(transfer.amount).toBe(5000);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw InsufficientBalanceError if balance is insufficient', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET TRANSACTION ISOLATION LEVEL
        .mockResolvedValueOnce({ rows: [{ id: 'wallet-1' }] }) // Lock wallet-1
        .mockResolvedValueOnce({ rows: [{ id: 'wallet-2' }] }) // Lock wallet-2
        .mockResolvedValueOnce({ rows: [{ balance: '1000' }] }); // Insufficient balance

      await expect(transferService.transfer(transferInput)).rejects.toThrow(
        InsufficientBalanceError
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw WalletNotFoundError if wallet does not exist', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET TRANSACTION ISOLATION LEVEL
        .mockResolvedValueOnce({ rows: [] }); // Wallet not found

      await expect(transferService.transfer(transferInput)).rejects.toThrow(
        WalletNotFoundError
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should lock wallets in consistent order (sorted by ID)', async () => {
      const input = {
        sender_wallet_id: 'wallet-z',
        receiver_wallet_id: 'wallet-a',
        amount: 1000,
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET TRANSACTION ISOLATION LEVEL
        .mockResolvedValueOnce({ rows: [{ id: 'wallet-a' }] }) // Lock wallet-a first (sorted)
        .mockResolvedValueOnce({ rows: [{ id: 'wallet-z' }] }) // Lock wallet-z second
        .mockResolvedValueOnce({ rows: [{ balance: '10000' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'transfer-123', status: 'pending', created_at: new Date() }] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({}) // Update transfer status
        .mockResolvedValueOnce({ rows: [{ // SELECT transfer after update
          id: 'transfer-123',
          sender_wallet_id: 'wallet-z',
          receiver_wallet_id: 'wallet-a',
          amount: '1000',
          status: 'completed',
          created_at: new Date(),
        }] })
        .mockResolvedValueOnce({}); // COMMIT

      await transferService.transfer(input);

      // Verify wallets are locked in sorted order (a before z)
      // Wallet IDs are in the parameters array (call[1]), not the SQL string
      const lockCalls = mockClient.query.mock.calls.filter((call: any) =>
        call[0]?.includes('FOR UPDATE')
      );
      expect(lockCalls[0][1][0]).toBe('wallet-a'); // First parameter of first lock call
      expect(lockCalls[1][1][0]).toBe('wallet-z'); // First parameter of second lock call
    });

    it('should rollback on any error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // SET TRANSACTION ISOLATION LEVEL
        .mockResolvedValueOnce({ rows: [{ id: 'wallet-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'wallet-2' }] })
        .mockResolvedValueOnce({ rows: [{ balance: '10000' }] })
        .mockRejectedValueOnce(new Error('Database error')); // Simulate error

      await expect(transferService.transfer(transferInput)).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
