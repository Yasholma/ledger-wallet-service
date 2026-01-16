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

**Backend:**

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Validation**: Zod
- **Logging**: Winston

**Frontend:**

- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **Styling**: CSS with CSS Variables

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
git clone https://github.com/Yasholma/ledger-wallet-service.git
cd ledger-wallet-service
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

### API Documentation

Interactive API documentation is available via Swagger UI:

- **Swagger UI**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

The Swagger documentation provides:

- Complete API endpoint descriptions
- Request/response schemas
- Example requests and responses
- Try-it-out functionality for testing endpoints

### Frontend Application

The project includes a React + TypeScript frontend built with Vite that provides a user-friendly interface for interacting with the wallet service.

**Features:**

- Create users and wallets
- Check wallet balance by email or user ID
- Fund wallets with external payment references
- Transfer funds between wallets
- View transaction history with pagination
- Session-based wallet ID persistence

**Running the Frontend:**

In development, start the frontend separately:

```bash
yarn dev:frontend
```

The frontend will be available at `http://localhost:5173` and automatically connects to the backend API at `http://localhost:3000`.

**Production Build:**

The frontend is automatically built and served with the backend when you run:

```bash
yarn build
yarn start
```

In production mode, the frontend is served from the backend at `http://localhost:3000`.

## API Endpoints

All API endpoints are versioned under `/api/v1`.

### POST /api/v1/users

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

### GET /api/v1/wallets/:userId/balance

Get the current balance for a user's wallet by user ID.

**Response:**

```json
{
  "wallet_id": "uuid",
  "user_id": "uuid",
  "balance": 10000
}
```

### GET /api/v1/wallets/balance/by-email/:email

Get the current balance for a user's wallet by email address.

**Parameters:**

- `email` (path): User's email address

**Response:**

```json
{
  "wallet_id": "uuid",
  "user_id": "uuid",
  "email": "user@example.com",
  "balance": 10000
}
```

### POST /api/v1/transactions/fund

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

### POST /api/v1/transactions/transfer

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

### GET /api/v1/transactions

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

### GET /api/v1/health

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

When two transfers try to debit the same wallet at roughly the same time, the system relies on the database to serialize those operations instead of trying to handle concurrency in application code.

Both transfers run inside database transactions, and only one of them is allowed to make progress on a given wallet at any point in time.

Here’s how that plays out in practice.

1. **Transactions and isolation**

   Each transfer runs inside a PostgreSQL transaction using the `SERIALIZABLE` isolation level. This means every transaction works against a consistent snapshot of the database and PostgreSQL will actively prevent unsafe interleavings.

2. **Locking the wallets**

   As soon as a transfer starts, it locks the sender and receiver wallets using `SELECT ... FOR UPDATE`. Once a wallet is locked, any other transfer touching that wallet has to wait until the current transaction finishes.

3. **Always locking in the same order**

   To avoid deadlocks, wallet rows are always locked in a predictable order (sorted by wallet ID). Even if two transfers involve the same wallets, they’ll try to acquire locks in the same sequence, so they queue instead of deadlocking.

4. **Balance checks happen under the lock**

   The sender’s balance is calculated after the lock is acquired by summing committed ledger entries. While the lock is held, no other transaction can add new entries for that wallet, so the balance check is reliable.

5. **What happens under contention**

   - The first transaction that gets the lock:

     - Calculates the balance
     - Verifies sufficient funds
     - Writes the debit and credit ledger entries
     - Commits

   - The second transaction waits. Once it continues:
     - It recalculates the balance, now including the first debit
     - Proceeds only if funds are still available
     - Otherwise fails and rolls back

---

### Why This Works

- **No double spending**  
  Only one transaction can modify a wallet at a time, and balance checks happen while holding the lock.

- **All-or-nothing behavior**  
  Ledger writes, balance validation, and transfer updates live in the same transaction. If anything fails, nothing is persisted.

- **Isolation you can trust**  
  Using `SERIALIZABLE` means transfers never see partial or inconsistent data, even under heavy concurrency.

- **Deadlocks are avoided by design**  
  Consistent lock ordering removes the most common cause of deadlocks in this kind of workflow.

---

### Database Guarantees We Rely On

Instead of reinventing concurrency control, the system leans on PostgreSQL’s guarantees:

- **ACID transactions** for atomicity and durability
- **`SERIALIZABLE` isolation** to prevent unsafe concurrent behavior
- **Row-level locks (`SELECT FOR UPDATE`)** to protect wallets during transfers
- **Unique constraints** (e.g. `external_payment_ref`) to prevent duplicate funding
- **Foreign keys** to enforce referential integrity

---

### Failure Scenarios

- **Insufficient balance**  
  The transaction fails validation and rolls back. No ledger entries are created.

- **Wallet not found**  
  The transaction rolls back and returns an error.

- **Database failure mid-transfer**  
  PostgreSQL rolls back automatically. There’s no partial state.

- **Deadlocks**  
  PostgreSQL can abort one transaction, but with consistent locking order this should be extremely rare.

- **Concurrent idempotency requests**  
  Handled at the database level using `INSERT ... ON CONFLICT`.

---

## Idempotency

All write operations (funding and transfers) are idempotent via the `Idempotency-Key` header.

### How It Works

1. **Key storage**

   Each idempotency key is stored alongside:

   - A hash of the request body
   - The response status and body
   - An expiration timestamp (default: 24 hours)

2. **Request handling**

   - Key exists and request hash matches → return the stored response
   - Key exists but hash differs → return `409 Conflict`
   - Key does not exist → process the request and store the result

3. **Concurrency handling**

   Multiple requests with the same key are handled safely using `INSERT ... ON CONFLICT`, so only one request actually executes.

4. **Cleanup**

   Expired keys can be cleaned up periodically. In a production system, this would run as a background job.

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

MIT
