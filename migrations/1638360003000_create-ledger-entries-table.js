"use strict";

module.exports.up = (pgm) => {
  return pgm.db.query(`
    CREATE TYPE ledger_direction AS ENUM ('credit', 'debit');
    
    CREATE TABLE ledger_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
      amount BIGINT NOT NULL CHECK (amount > 0),
      direction ledger_direction NOT NULL,
      transaction_reference VARCHAR(255) NOT NULL,
      transfer_id UUID REFERENCES transfers(id) ON DELETE SET NULL,
      external_payment_ref VARCHAR(255) UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    
    CREATE INDEX idx_ledger_entries_wallet_id ON ledger_entries(wallet_id);
    CREATE INDEX idx_ledger_entries_wallet_id_created_at ON ledger_entries(wallet_id, created_at);
    CREATE INDEX idx_ledger_entries_transaction_reference ON ledger_entries(transaction_reference);
    CREATE INDEX idx_ledger_entries_transfer_id ON ledger_entries(transfer_id);
    CREATE INDEX idx_ledger_entries_external_payment_ref ON ledger_entries(external_payment_ref);
  `);
};

module.exports.down = (pgm) => {
  return pgm.db.query(`
    DROP TABLE IF EXISTS ledger_entries CASCADE;
    DROP TYPE IF EXISTS ledger_direction;
  `);
};
