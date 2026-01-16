"use strict";

module.exports.up = (pgm) => {
  return pgm.db.query(`
    CREATE TABLE idempotency_keys (
      key VARCHAR(255) PRIMARY KEY,
      request_hash VARCHAR(64) NOT NULL,
      response_status INTEGER NOT NULL,
      response_body JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL
    );
    
    CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);
  `);
};

module.exports.down = (pgm) => {
  return pgm.db.query(`
    DROP TABLE IF EXISTS idempotency_keys CASCADE;
  `);
};
