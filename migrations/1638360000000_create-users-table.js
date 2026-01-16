"use strict";

module.exports.up = (pgm) => {
  return pgm.db.query(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    
    CREATE INDEX idx_users_email ON users(email);
  `);
};

module.exports.down = (pgm) => {
  return pgm.db.query(`
    DROP TABLE IF EXISTS users CASCADE;
  `);
};
