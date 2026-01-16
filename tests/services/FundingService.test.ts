import { FundingService } from '../../src/services/FundingService';
import { LedgerService } from '../../src/services/LedgerService';
import { DuplicatePaymentRefError } from '../../src/utils/errors';

jest.mock('../../src/services/LedgerService');

describe('FundingService', () => {
  let fundingService: FundingService;
  let mockLedgerService: jest.Mocked<LedgerService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLedgerService = {
      findEntryByExternalPaymentRef: jest.fn(),
      createEntry: jest.fn(),
    } as any;

    fundingService = new FundingService(mockLedgerService);
  });

  describe('fundWallet', () => {
    const fundInput = {
      walletId: 'wallet-123',
      amount: 10000,
      externalPaymentRef: 'payment-123',
    };

    it('should create new funding entry when payment ref does not exist', async () => {
      mockLedgerService.findEntryByExternalPaymentRef.mockResolvedValueOnce(null);
      
      const mockEntry = {
        id: 'entry-123',
        wallet_id: 'wallet-123',
        amount: 10000,
        direction: 'credit' as const,
        transaction_reference: 'fund-uuid',
        transfer_id: null,
        external_payment_ref: 'payment-123',
        created_at: new Date(),
      };

      mockLedgerService.createEntry.mockResolvedValueOnce(mockEntry);

      const entry = await fundingService.fundWallet(fundInput);

      expect(entry).toEqual(mockEntry);
      expect(mockLedgerService.findEntryByExternalPaymentRef).toHaveBeenCalledWith('payment-123');
      expect(mockLedgerService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          wallet_id: 'wallet-123',
          amount: 10000,
          direction: 'credit',
          external_payment_ref: 'payment-123',
        })
      );
    });

    it('should throw DuplicatePaymentRefError when payment ref already exists', async () => {
      const existingEntry = {
        id: 'entry-existing',
        wallet_id: 'wallet-123',
        amount: 10000,
        direction: 'credit' as const,
        transaction_reference: 'fund-old',
        transfer_id: null,
        external_payment_ref: 'payment-123',
        created_at: new Date(),
      };

      mockLedgerService.findEntryByExternalPaymentRef.mockResolvedValueOnce(existingEntry);

      await expect(fundingService.fundWallet(fundInput)).rejects.toThrow(
        DuplicatePaymentRefError
      );
      expect(mockLedgerService.createEntry).not.toHaveBeenCalled();
    });

    it('should create entry with correct transaction reference format', async () => {
      mockLedgerService.findEntryByExternalPaymentRef.mockResolvedValueOnce(null);
      
      const mockEntry = {
        id: 'entry-123',
        wallet_id: 'wallet-123',
        amount: 10000,
        direction: 'credit' as const,
        transaction_reference: 'fund-uuid',
        transfer_id: null,
        external_payment_ref: 'payment-123',
        created_at: new Date(),
      };

      mockLedgerService.createEntry.mockResolvedValueOnce(mockEntry);

      await fundingService.fundWallet(fundInput);

      const createCall = mockLedgerService.createEntry.mock.calls[0][0];
      expect(createCall.transaction_reference).toMatch(/^fund_/);
    });
  });
});
