// Test setup file
// This runs before all tests

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'ledger_wallet_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.LOG_LEVEL = 'silent'; // Suppress all logs during tests

// Suppress Winston console output during tests
// This is done by setting the log level to 'silent' which Winston supports
// and also by removing console transports if they exist
