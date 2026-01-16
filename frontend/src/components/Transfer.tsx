import { useState, useEffect } from 'react';
import { api } from '../services/api';
import './Form.css';

interface TransferProps {
  senderWalletId?: string;
}

export default function Transfer({ senderWalletId: initialSenderWalletId = '' }: TransferProps) {
  const [senderWalletId, setSenderWalletId] = useState(initialSenderWalletId);
  const [receiverWalletId, setReceiverWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (initialSenderWalletId) {
      setSenderWalletId(initialSenderWalletId);
    }
  }, [initialSenderWalletId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Convert amount to cents (integer)
      const amountInCents = Math.round(parseFloat(amount) * 100);
      
      if (amountInCents <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      const response = await api.transferFunds(
        senderWalletId,
        receiverWalletId,
        amountInCents
      );
      
      setSuccess(
        `Transfer completed successfully! Transfer ID: ${response.transfer.id}`
      );
      setAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer funds');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Transfer Funds</h2>
      <p className="card-description">
        Transfer funds between two wallets.
      </p>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label htmlFor="senderWalletId">Sender Wallet ID</label>
          <input
            id="senderWalletId"
            type="text"
            value={senderWalletId}
            onChange={(e) => setSenderWalletId(e.target.value)}
            required
            placeholder="Enter sender wallet ID"
          />
        </div>

        <div className="form-group">
          <label htmlFor="receiverWalletId">Receiver Wallet ID</label>
          <input
            id="receiverWalletId"
            type="text"
            value={receiverWalletId}
            onChange={(e) => setReceiverWalletId(e.target.value)}
            required
            placeholder="Enter receiver wallet ID"
          />
        </div>

        <div className="form-group">
          <label htmlFor="amount">Amount (USD)</label>
          <input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="0.00"
          />
        </div>

        {error && <div className="message error">{error}</div>}
        {success && <div className="message success">{success}</div>}

        <button type="submit" className="button button-primary" disabled={loading}>
          {loading ? 'Processing...' : 'Transfer Funds'}
        </button>
      </form>
    </div>
  );
}
