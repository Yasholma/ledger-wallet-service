import { useState, useEffect } from 'react';
import { api, UserWithWallet } from '../services/api';
import './Form.css';

interface FundWalletProps {
  walletId?: string;
}

export default function FundWallet({ walletId: initialWalletId = '' }: FundWalletProps) {
  const [users, setUsers] = useState<UserWithWallet[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [walletId, setWalletId] = useState(initialWalletId);
  const [amount, setAmount] = useState('');
  const [externalPaymentRef, setExternalPaymentRef] = useState('');
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
        
        // If initialWalletId is provided, find and select that user
        if (initialWalletId) {
          const user = response.users.find(u => u.wallet_id === initialWalletId);
          if (user) {
            setSelectedUserId(user.id);
            setWalletId(user.wallet_id);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch users');
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [initialWalletId]);

  const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const userId = e.target.value;
    const user = users.find(u => u.id === userId);
    if (user) {
      setSelectedUserId(userId);
      setWalletId(user.wallet_id);
    }
  };

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

      const response = await api.fundWallet(
        walletId,
        amountInCents,
        externalPaymentRef
      );
      
      setSuccess(
        `Wallet funded successfully! Transaction ID: ${response.transaction.id}`
      );
      setAmount('');
      setExternalPaymentRef('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fund wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Fund Wallet</h2>
      <p className="card-description">
        Add funds to a wallet using an external payment reference.
      </p>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label htmlFor="userSelect">Select User</label>
          <select
            id="userSelect"
            value={selectedUserId}
            onChange={handleUserChange}
            disabled={loadingUsers}
            required
          >
            <option value="">-- Select a user --</option>
            {users.map((user) => (
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

        <div className="form-group">
          <label htmlFor="externalPaymentRef">External Payment Reference</label>
          <input
            id="externalPaymentRef"
            type="text"
            value={externalPaymentRef}
            onChange={(e) => setExternalPaymentRef(e.target.value)}
            required
            placeholder="payment-ref-123"
          />
        </div>

        {loadingUsers && <div className="message">Loading users...</div>}
        {error && <div className="message error">{error}</div>}
        {success && <div className="message success">{success}</div>}

        <button type="submit" className="button button-primary" disabled={loading}>
          {loading ? 'Processing...' : 'Fund Wallet'}
        </button>
      </form>
    </div>
  );
}
