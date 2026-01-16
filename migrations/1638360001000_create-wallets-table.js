"use strict";

module.exports.up = (pgm) => {
  return pgm.db.query(`
    CREATE TABLE wallets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id)
    );
    
    CREATE INDEX idx_wallets_user_id ON wallets(user_id);
  `);
};

module.exports.down = (pgm) => {
  return pgm.db.query(`
    DROP TABLE IF EXISTS wallets CASCADE;
  `);
};
