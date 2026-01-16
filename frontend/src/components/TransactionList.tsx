import { useState, useEffect, useCallback } from 'react';
import { api, Transaction, UserWithWallet } from '../services/api';
import { formatCurrency } from '../utils/format';
import './Form.css';

interface TransactionListProps {
  walletId?: string;
}

export default function TransactionList({ walletId: initialWalletId }: TransactionListProps) {
  const [users, setUsers] = useState<UserWithWallet[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [walletId, setWalletId] = useState(initialWalletId || '');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);

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
      setOffset(0); // Reset to first page when user changes
    }
  };

  const fetchTransactions = useCallback(async () => {
    if (!walletId.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.getTransactions(walletId, limit, offset);
      setTransactions(response.transactions);
      setTotal(response.pagination.total || response.transactions.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [walletId, limit, offset]);

  useEffect(() => {
    if (walletId) {
      fetchTransactions();
    }
  }, [walletId, fetchTransactions]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="card">
      <h2>Transaction History</h2>
      <p className="card-description">
        View transaction history for a wallet.
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
      {loading && selectedUserId && <div className="message">Loading transactions...</div>}

      {transactions.length > 0 && (
        <div className="transactions-container">
          <div className="transactions-header">
            <h3>Transactions ({total !== null ? total : transactions.length})</h3>
            <div className="pagination-controls">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0 || loading}
              >
                Previous
              </button>
              <span className="pagination-info">
                Showing {offset + 1} - {Math.min(offset + limit, total || transactions.length)} of {total || transactions.length}
              </span>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setOffset(offset + limit)}
                disabled={transactions.length < limit || loading}
              >
                Next
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Amount</th>
                  <th>Direction</th>
                  <th>Transaction Ref</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="tx-id">{tx.id.slice(0, 8)}...</td>
                    <td className={`tx-amount ${tx.direction}`}>
                      {tx.direction === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>
                    <td>
                      <span className={`badge ${tx.direction}`}>
                        {tx.direction}
                      </span>
                    </td>
                    <td className="tx-ref">{tx.transaction_reference}</td>
                    <td className="tx-date">{formatDate(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && walletId && transactions.length === 0 && (
        <div className="message info">No transactions found for this wallet.</div>
      )}
    </div>
  );
}
