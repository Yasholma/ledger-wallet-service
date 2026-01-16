import { useState } from 'react';
import { api } from '../services/api';
import './Form.css';

interface UserFormProps {
  onUserCreated: (userId: string, walletId: string) => void;
}

export default function UserForm({ onUserCreated }: UserFormProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.createUser(email, name);
      setSuccess(`User created successfully! User ID: ${response.user.id}`);
      onUserCreated(response.user.id, response.wallet.id);
      setEmail('');
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Create User</h2>
      <p className="card-description">
        Create a new user account and associated wallet.
      </p>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="user@example.com"
          />
        </div>

        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="John Doe"
          />
        </div>

        {error && <div className="message error">{error}</div>}
        {success && <div className="message success">{success}</div>}

        <button type="submit" className="button button-primary" disabled={loading}>
          {loading ? 'Creating...' : 'Create User'}
        </button>
      </form>
    </div>
  );
}
