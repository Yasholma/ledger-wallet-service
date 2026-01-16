# Ledger-Based Wallet & Transfer Service

A fintech-style ledger service for managing user balances and transfers. This service implements a strict ledger-based accounting system where all balances are derived from immutable ledger entries, ensuring correctness, auditability, and safety under concurrency.

## Features

- **Ledger-Based Accounting**: All balances are computed from immutable ledger entries (no mutable balance column)
- **Idempotent Operations**: All write operations support idempotency keys to prevent duplicate processing
- **Atomic Transfers**: Transfers between wallets are fully atomic with proper concurrency controls
- **Audit Trail**: Complete transaction history with traceable transfers
- **Concurrency Safe**: Handles concurrent transfers safely using database transactions and locking

## Architecture Overview

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Validation**: Zod
- **Logging**: Winston

### Database Schema

The system uses five core tables:

1. **users**: User accounts
2. **wallets**: Wallet metadata (no balance column)
3. **ledger_entries**: Immutable, append-only ledger entries
4. **transfers**: Transfer records that group related ledger entries
5. **idempotency_keys**: Idempotency key storage with request/response caching

### Core Principles

1. **Immutable Ledger**: All monetary movements are recorded as immutable ledger entries
2. **Derived Balances**: Balances are calculated as `SUM(credits) - SUM(debits)` from ledger entries
3. **Atomic Operations**: Transfers use database transactions with SERIALIZABLE isolation
4. **Idempotency**: All write operations accept `Idempotency-Key` headers

## Setup Instructions

### Prerequisites

- Node.js 18+ and yarn
- PostgreSQL 12+

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd bmoni
```

2. Install dependencies:

```bash
yarn install
```

3. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Create the database:

```bash
createdb ledger_wallet_db
```

5. Run migrations:

```bash
yarn migrate:up
```

6. Build the project:

```bash
yarn build
```

7. Start the server:

```bash
yarn start
# Or for development:
yarn dev
```

The server will start on `http://localhost:3000` by default.

## API Endpoints

### POST /users

Create a new user and associated wallet.

**Request:**

```json
{
  "email": "user@example.com",
  "name": "John Doe"
}
```

**Response:**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "wallet": {
    "id": "uuid",
    "user_id": "uuid",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### GET /wallets/:userId/balance

Get the current balance for a user's wallet.

**Response:**

```json
{
  "wallet_id": "uuid",
  "user_id": "uuid",
  "balance": 10000
}
```

### POST /transactions/fund

Fund a wallet via external payment reference. Requires `Idempotency-Key` header.

**Headers:**

```
Idempotency-Key: <unique-key>
```

**Request:**

```json
{
  "walletId": "uuid",
  "amount": 10000,
  "externalPaymentRef": "payment_12345"
}
```

**Response:**

```json
{
  "transaction": {
    "id": "uuid",
    "wallet_id": "uuid",
    "amount": 10000,
    "direction": "credit",
    "transaction_reference": "fund_uuid",
    "external_payment_ref": "payment_12345",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /transactions/transfer

Transfer funds between two wallets. Requires `Idempotency-Key` header.

**Headers:**

```
Idempotency-Key: <unique-key>
```

**Request:**

```json
{
  "senderWalletId": "uuid",
  "receiverWalletId": "uuid",
  "amount": 5000
}
```

**Response:**

```json
{
  "transfer": {
    "id": "uuid",
    "sender_wallet_id": "uuid",
    "receiver_wallet_id": "uuid",
    "amount": 5000,
    "status": "completed",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### GET /transactions

Get transaction history for a wallet.

**Query Parameters:**

- `walletId` (required): Wallet UUID
- `limit` (optional): Number of results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**

```json
{
  "transactions": [
    {
      "id": "uuid",
      "wallet_id": "uuid",
      "amount": 10000,
      "direction": "credit",
      "transaction_reference": "fund_uuid",
      "transfer_id": null,
      "external_payment_ref": "payment_12345",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "count": 1
  }
}
```

### GET /health

Health check endpoint with database connectivity verification.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected"
}
```

## Concurrency & Consistency Guarantees

### Scenario: Two Concurrent Transfers Debiting the Same Wallet

When two transfers attempt to debit the same wallet simultaneously, the system ensures correctness through the following mechanism:

1. **Transaction Isolation**: Both transactions begin with `SERIALIZABLE` isolation level, which provides the strongest consistency guarantee in PostgreSQL. This ensures that transactions see a consistent snapshot of the database and prevents phantom reads.

2. **Row-Level Locking**: When a transfer begins, it acquires row-level locks on both the sender and receiver wallets using `SELECT ... FOR UPDATE`. This prevents other transactions from modifying these wallets until the lock is released.

3. **Consistent Locking Order**: To prevent deadlocks, wallets are always locked in a consistent order (sorted by wallet ID). This ensures that if two transfers involve overlapping wallets, they will always acquire locks in the same order, eliminating the possibility of circular wait conditions.

4. **Balance Calculation**: Within the transaction, the sender's balance is calculated from all committed ledger entries. Because of the row-level lock, no other transaction can modify the ledger entries for this wallet until the lock is released.

5. **Sequential Processing**: The first transaction to acquire the lock will:

   - Calculate the current balance
   - Validate sufficient funds
   - Create the debit and credit ledger entries
   - Commit the transaction

6. **Second Transaction Behavior**: The second transaction will wait for the lock to be released. Once it acquires the lock:
   - It calculates the balance, which now includes the first transaction's debit
   - If sufficient funds remain, it proceeds; otherwise, it fails validation
   - The transaction either completes or rolls back atomically

### Why This Approach is Safe

- **No Double-Spending**: The row-level lock ensures that only one transaction can modify a wallet's ledger entries at a time. The balance check happens within the locked transaction, so it sees a consistent state.

- **Atomicity**: All operations (balance check, ledger entry creation, transfer status update) happen within a single database transaction. If any step fails, the entire transaction rolls back, leaving the system in a consistent state.

- **Isolation**: SERIALIZABLE isolation prevents transactions from seeing uncommitted changes from other transactions, ensuring that balance calculations are based on committed data only.

- **Deadlock Prevention**: Consistent locking order eliminates the possibility of deadlocks when multiple transfers involve overlapping wallets.

### Database Guarantees We Rely On

1. **ACID Transactions**: PostgreSQL's transaction system ensures atomicity, consistency, isolation, and durability.

2. **SERIALIZABLE Isolation Level**: This is the strongest isolation level, providing true serialization of concurrent transactions. It prevents:

   - Dirty reads
   - Non-repeatable reads
   - Phantom reads
   - Serialization anomalies

3. **Row-Level Locking (SELECT FOR UPDATE)**: This provides exclusive locks on specific rows, preventing concurrent modifications.

4. **Unique Constraints**: The `external_payment_ref` column has a UNIQUE constraint, preventing duplicate funding operations at the database level.

5. **Foreign Key Constraints**: These ensure referential integrity between wallets, users, and ledger entries.

### Failure Scenarios and Recovery

- **Insufficient Balance**: Transaction rolls back atomically, no ledger entries are created, wallet state unchanged.

- **Wallet Not Found**: Transaction rolls back, returns 404 error.

- **Database Connection Loss**: Transaction automatically rolls back, no partial state.

- **Deadlock (theoretical)**: PostgreSQL automatically detects and rolls back one transaction, which can be retried. Our consistent locking order makes this extremely rare.

- **Concurrent Idempotency Key Insert**: Handled via `INSERT ... ON CONFLICT`, ensuring only one request with the same key is processed.

## Idempotency

All write operations (funding and transfers) support idempotency via the `Idempotency-Key` header.

### How It Works

1. **Key Storage**: Idempotency keys are stored in the `idempotency_keys` table with:

   - The idempotency key (primary key)
   - A hash of the request body
   - The response status and body
   - An expiration timestamp (default: 24 hours)

2. **Request Processing**:

   - If the key exists and request hash matches → return cached response
   - If the key exists but hash differs → return 409 Conflict
   - If the key doesn't exist → process request and store response

3. **Conflict Handling**: Uses `INSERT ... ON CONFLICT` to handle race conditions when multiple requests with the same key arrive simultaneously.

4. **Cleanup**: Expired keys can be cleaned up via the `cleanupExpiredKeys()` method. In production, this would run as a periodic background job.

## Data Integrity Rules

- **No Negative Balances**: Transfers validate sufficient balance before creating ledger entries
- **Immutable Ledger**: Ledger entries are append-only and never modified
- **Unique External Payment References**: Database constraint prevents duplicate funding
- **Traceable Transfers**: All transfer-related ledger entries share the same `transfer_id` and `transaction_reference`

## Security

- **Input Validation**: All inputs are validated using Zod schemas
- **Amount Validation**: Negative or zero amounts are rejected
- **UUID Validation**: All IDs are validated as proper UUIDs
- **Authentication**: Placeholder middleware exists (see `src/middleware/auth.ts`) for JWT-based authentication

## Observability

- **Structured Logging**: All operations are logged with structured data using Winston
- **Correlation IDs**: Requests can be traced through the system
- **Health Check**: `/health` endpoint monitors database connectivity
- **Error Responses**: Clear error messages with error codes

## Development

### Running Migrations

```bash
# Run all pending migrations
yarn migrate:up

# Rollback last migration
yarn migrate:down
```

### Project Structure

```
src/
├── config/          # Database configuration
├── models/          # TypeScript type definitions
├── services/        # Business logic
├── middleware/      # Express middleware
├── routes/          # API route handlers
├── utils/           # Utilities (logger, errors)
└── app.ts           # Express app setup
```

## Testing

The project includes both unit tests and end-to-end (e2e) tests.

### Unit Tests

Unit tests use mocks and don't require a database connection. They test individual services and utilities in isolation.

**Run unit tests:**

```bash
yarn test
```

**Run unit tests with output:**

```bash
yarn test --silent=false
```

### End-to-End Tests

E2E tests require a real PostgreSQL database connection and test the full API flow.

**Setup for E2E tests:**

1. Create a test database:

```bash
createdb ledger_wallet_test
```

2. Create `.env.test` file in the project root:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ledger_wallet_test
DB_USER=postgres
DB_PASSWORD=postgres
LOG_LEVEL=silent
```

3. **IMPORTANT**: Run migrations on the test database. You can use:

   **Option A**: Use the provided script (loads .env.test automatically):

   ```bash
   yarn migrate:test
   ```

   **Option B**: Set environment variables inline:

   ```bash
   DB_NAME=ledger_wallet_test DB_HOST=localhost DB_USER=postgres DB_PASSWORD=postgres yarn migrate:up
   ```

   ⚠️ **The test database MUST have migrations run before e2e tests will work!**

**Run E2E tests:**

```bash
yarn test:e2e
```

**Run all tests (unit + e2e):**

```bash
yarn test:all
```

### Test Coverage

- **Unit Tests**: Services (LedgerService, TransferService, FundingService, IdempotencyService), utilities (errors), and business logic
- **E2E Tests**: Full API endpoints including:
  - User creation and validation
  - Wallet balance queries
  - Funding operations with idempotency
  - Transfers with concurrency safety
  - Transaction history queries
  - Error handling and edge cases

### Test Structure

```
tests/
├── __mocks__/          # Database mocks for unit tests
├── services/           # Unit tests for services
├── utils/              # Unit tests for utilities
├── e2e/                # End-to-end tests
│   ├── setup.ts        # E2E test setup and database connection
│   ├── helpers.ts      # Test helper functions
│   ├── users.e2e.test.ts
│   ├── wallets.e2e.test.ts
│   └── transactions.e2e.test.ts
└── setup.ts            # Unit test setup
```

## License

ISC
