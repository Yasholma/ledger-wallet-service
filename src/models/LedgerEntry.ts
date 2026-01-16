export type LedgerDirection = "credit" | "debit";

export interface LedgerEntry {
  id: string;
  wallet_id: string;
  amount: number;
  direction: LedgerDirection;
  transaction_reference: string;
  transfer_id: string | null;
  external_payment_ref: string | null;
  created_at: Date;
}

export interface CreateLedgerEntryInput {
  wallet_id: string;
  amount: number;
  direction: LedgerDirection;
  transaction_reference: string;
  transfer_id?: string | null;
  external_payment_ref?: string | null;
}
