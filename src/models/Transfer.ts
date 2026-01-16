export type TransferStatus = 'pending' | 'completed' | 'failed';

export interface Transfer {
  id: string;
  sender_wallet_id: string;
  receiver_wallet_id: string;
  amount: number;
  status: TransferStatus;
  created_at: Date;
}

export interface CreateTransferInput {
  sender_wallet_id: string;
  receiver_wallet_id: string;
  amount: number;
}
