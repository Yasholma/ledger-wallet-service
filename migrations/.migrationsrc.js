require('dotenv').config();

module.exports = {
  'migrations-table': 'pgmigrations',
  'connection-string': process.env.DATABASE_URL || 
    `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'ledger_wallet_db'}`,
};
