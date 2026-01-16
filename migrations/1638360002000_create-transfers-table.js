"use strict";

module.exports.up = (pgm) => {
  return pgm.db.query(`
    CREATE TYPE transfer_status AS ENUM ('pending', 'completed', 'failed');
    
    CREATE TABLE transfers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
      receiver_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
      amount BIGINT NOT NULL CHECK (amount > 0),
      status transfer_status NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    
    CREATE INDEX idx_transfers_sender_wallet_id ON transfers(sender_wallet_id);
    CREATE INDEX idx_transfers_receiver_wallet_id ON transfers(receiver_wallet_id);
    CREATE INDEX idx_transfers_status ON transfers(status);
  `);
};

module.exports.down = (pgm) => {
  return pgm.db.query(`
    DROP TABLE IF EXISTS transfers CASCADE;
    DROP TYPE IF EXISTS transfer_status;
  `);
};
