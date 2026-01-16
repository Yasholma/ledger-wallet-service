import { useState, useEffect } from 'react';
import { api } from '../services/api';
import './Form.css';

type SearchType = 'email' | 'userId';

interface BalanceProps {
  userId?: string;
  email?: string;
  searchType?: SearchType;
  onSearchTypeChange?: (type: SearchType) => void;
  onEmailChange?: (email: string) => void;
  onUserIdChange?: (userId: string) => void;
  onBalanceFound?: (walletId: string, userId: string, email?: string) => void;
}

export default function Balance({
  userId: initialUserId = '',
  email: initialEmail = '',
  searchType: initialSearchType = 'email',
  onSearchTypeChange,
  onEmailChange,
  onUserIdChange,
  onBalanceFound,
}: BalanceProps) {
  const [searchType, setSearchType] = useState<SearchType>(initialSearchType);
  const [email, setEmail] = useState(initialEmail);
  const [userId, setUserId] = useState(initialUserId);
  const [balance, setBalance] = useState<number | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearchType(initialSearchType);
    setEmail(initialEmail);
    setUserId(initialUserId);
  }, [initialSearchType, initialEmail, initialUserId]);

  const handleSearchTypeChange = (newSearchType: SearchType) => {
    setSearchType(newSearchType);
    if (onSearchTypeChange) {
      onSearchTypeChange(newSearchType);
    }
    setBalance(null);
    setWalletId(null);
    setUserEmail(null);
    setError(null);
  };

  const handleEmailChange = (newEmail: string) => {
    setEmail(newEmail);
    if (onEmailChange) {
      onEmailChange(newEmail);
    }
  };

  const handleUserIdChange = (newUserId: string) => {
    setUserId(newUserId);
    if (onUserIdChange) {
      onUserIdChange(newUserId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (searchType === 'email' && !email.trim()) return;
    if (searchType === 'userId' && !userId.trim()) return;

    setLoading(true);
    setError(null);
    setBalance(null);
    setWalletId(null);
    setUserEmail(null);

    try {
      const response = searchType === 'email'
        ? await api.getBalanceByEmail(email.trim())
        : await api.getBalance(userId.trim());
      
      setBalance(response.balance);
      setWalletId(response.wallet_id);
      const foundEmail = response.email || null;
      const foundUserId = response.user_id;
      
      if (foundEmail) {
        setUserEmail(foundEmail);
      }

      if (onBalanceFound) {
        onBalanceFound(response.wallet_id, foundUserId, foundEmail || undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balance');
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return (amount / 100).toFixed(2);
  };

  return (
    <div className="card">
      <h2>Wallet Balance</h2>
      <p className="card-description">
        Check the balance for a user's wallet by email or user ID.
      </p>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label htmlFor="searchType">Search By</label>
          <select
            id="searchType"
            value={searchType}
            onChange={(e) => {
              handleSearchTypeChange(e.target.value as SearchType);
            }}
          >
            <option value="email">Email</option>
            <option value="userId">User ID</option>
          </select>
        </div>

        {searchType === 'email' ? (
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              required
              placeholder="Enter user email"
            />
          </div>
        ) : (
          <div className="form-group">
            <label htmlFor="userId">User ID</label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => handleUserIdChange(e.target.value)}
              required
              placeholder="Enter user ID"
            />
          </div>
        )}

        <button type="submit" className="button button-primary" disabled={loading}>
          {loading ? 'Loading...' : 'Get Balance'}
        </button>
      </form>

      {error && <div className="message error">{error}</div>}

      {balance !== null && walletId && (
        <div className="balance-result">
          <div className="balance-card">
            <div className="balance-label">Balance</div>
            <div className="balance-amount">${formatAmount(balance)}</div>
            <div className="balance-details">
              <div>Wallet ID: {walletId}</div>
              {userEmail && <div>Email: {userEmail}</div>}
              <div>User ID: {userId || 'N/A'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
