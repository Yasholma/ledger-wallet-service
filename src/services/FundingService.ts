import { LedgerService, ledgerService } from "./LedgerService";
import { LedgerEntry } from "../models/LedgerEntry";
import { DuplicatePaymentRefError } from "../utils/errors";
import { logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";

export interface FundWalletInput {
  walletId: string;
  amount: number;
  externalPaymentRef: string;
}

export class FundingService {
  constructor(private ledgerService: LedgerService) {}

  async fundWallet(input: FundWalletInput): Promise<LedgerEntry> {
    const existingEntry =
      await this.ledgerService.findEntryByExternalPaymentRef(
        input.externalPaymentRef
      );

    if (existingEntry) {
      logger.warn("Duplicate external payment reference detected", {
        externalPaymentRef: input.externalPaymentRef,
        existingEntryId: existingEntry.id,
      });
      throw new DuplicatePaymentRefError(input.externalPaymentRef);
    }

    const transactionReference = `fund_${uuidv4()}`;

    const entry = await this.ledgerService.createEntry({
      wallet_id: input.walletId,
      amount: input.amount,
      direction: "credit",
      transaction_reference: transactionReference,
      external_payment_ref: input.externalPaymentRef,
    });

    logger.info("Wallet funded", {
      walletId: input.walletId,
      amount: input.amount,
      externalPaymentRef: input.externalPaymentRef,
      entryId: entry.id,
    });

    return entry;
  }
}

export const fundingService = new FundingService(ledgerService);
