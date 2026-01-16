import { useState, useEffect, useCallback } from 'react';
import { api, Transaction } from '../services/api';
import './Form.css';

interface TransactionListProps {
  walletId?: string;
}

export default function TransactionList({ walletId: initialWalletId }: TransactionListProps) {
  const [walletId, setWalletId] = useState(initialWalletId || '');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    fetchTransactions();
  };

  const formatAmount = (amount: number) => {
    return (amount / 100).toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="card">
      <h2>Transaction History</h2>
      <p className="card-description">
        View transaction history for a wallet.
      </p>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label htmlFor="walletId">Wallet ID</label>
          <input
            id="walletId"
            type="text"
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
            required
            placeholder="Enter wallet ID"
          />
        </div>

        <button type="submit" className="button button-primary" disabled={loading}>
          {loading ? 'Loading...' : 'Load Transactions'}
        </button>
      </form>

      {error && <div className="message error">{error}</div>}

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
                      {tx.direction === 'credit' ? '+' : '-'}${formatAmount(tx.amount)}
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
