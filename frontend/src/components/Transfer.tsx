import { useState, useEffect } from 'react';
import { api, UserWithWallet } from '../services/api';
import './Form.css';

interface TransferProps {
  senderWalletId?: string;
}

export default function Transfer({ senderWalletId: initialSenderWalletId = '' }: TransferProps) {
  const [users, setUsers] = useState<UserWithWallet[]>([]);
  const [senderUserId, setSenderUserId] = useState<string>('');
  const [receiverUserId, setReceiverUserId] = useState<string>('');
  const [senderWalletId, setSenderWalletId] = useState(initialSenderWalletId);
  const [receiverWalletId, setReceiverWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const response = await api.getUsers();
        setUsers(response.users);
        
        // If initialSenderWalletId is provided, find and select that user
        if (initialSenderWalletId) {
          const user = response.users.find(u => u.wallet_id === initialSenderWalletId);
          if (user) {
            setSenderUserId(user.id);
            setSenderWalletId(user.wallet_id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch users');
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [initialSenderWalletId]);

  const handleSenderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const userId = e.target.value;
    const user = users.find(u => u.id === userId);
    if (user) {
      setSenderUserId(userId);
      setSenderWalletId(user.wallet_id);
    }
  };

  const handleReceiverChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const userId = e.target.value;
    const user = users.find(u => u.id === userId);
    if (user) {
      setReceiverUserId(userId);
      setReceiverWalletId(user.wallet_id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate sender and receiver are different
      if (senderWalletId === receiverWalletId) {
        throw new Error('Sender and receiver must be different');
      }

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
          <label htmlFor="senderSelect">Select Sender</label>
          <select
            id="senderSelect"
            value={senderUserId}
            onChange={handleSenderChange}
            disabled={loadingUsers}
            required
          >
            <option value="">-- Select sender --</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="receiverSelect">Select Receiver</label>
          <select
            id="receiverSelect"
            value={receiverUserId}
            onChange={handleReceiverChange}
            disabled={loadingUsers}
            required
          >
            <option value="">-- Select receiver --</option>
            {users
              .filter((user) => user.id !== senderUserId)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
          </select>
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

        {loadingUsers && <div className="message">Loading users...</div>}
        {error && <div className="message error">{error}</div>}
        {success && <div className="message success">{success}</div>}

        <button type="submit" className="button button-primary" disabled={loading}>
          {loading ? 'Processing...' : 'Transfer Funds'}
        </button>
      </form>
    </div>
  );
}
