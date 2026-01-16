import { useState, useEffect } from 'react';
import { api, UserWithWallet } from '../services/api';
import { formatCurrency } from '../utils/format';
import './Form.css';

interface BalanceProps {
  userId?: string;
  email?: string;
  onBalanceFound?: (walletId: string, userId: string, email?: string) => void;
}

export default function Balance({
  userId: initialUserId = '',
  email: initialEmail = '',
  onBalanceFound,
}: BalanceProps) {
  const [users, setUsers] = useState<UserWithWallet[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(initialUserId || '');
  const [balance, setBalance] = useState<number | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithWallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const response = await api.getUsers();
        setUsers(response.users);
        
        // If initialUserId is provided, select that user
        if (initialUserId) {
          const user = response.users.find(u => u.id === initialUserId);
          if (user) {
            setSelectedUserId(user.id);
            setSelectedUser(user);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch users');
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [initialUserId]);

  useEffect(() => {
    // Auto-fetch balance when user is selected
    if (selectedUserId && users.length > 0) {
      fetchBalance(selectedUserId);
    }
  }, [selectedUserId, users]);

  const fetchBalance = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    setLoading(true);
    setError(null);
    setBalance(null);
    setWalletId(null);
    setSelectedUser(user);

    try {
      const response = await api.getBalance(userId);
      
      setBalance(response.balance);
      setWalletId(response.wallet_id);

      if (onBalanceFound) {
        onBalanceFound(response.wallet_id, response.user_id, user.email);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balance');
    } finally {
      setLoading(false);
    }
  };

  const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const userId = e.target.value;
    setSelectedUserId(userId);
  };

  return (
    <div className="card">
      <h2>Wallet Balance</h2>
      <p className="card-description">
        Select a user to view their wallet balance.
      </p>

      <form className="form">
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
      </form>

      {loadingUsers && <div className="message">Loading users...</div>}
      {error && <div className="message error">{error}</div>}
      {loading && selectedUserId && <div className="message">Loading balance...</div>}

      {balance !== null && walletId && selectedUser && (
        <div className="balance-result">
          <div className="balance-card">
            <div className="balance-label">Balance</div>
            <div className="balance-amount">{formatCurrency(balance)}</div>
            <div className="balance-details">
              <div>User: {selectedUser.name}</div>
              <div>Email: {selectedUser.email}</div>
              <div>Wallet ID: {walletId}</div>
              <div>User ID: {selectedUser.id}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
