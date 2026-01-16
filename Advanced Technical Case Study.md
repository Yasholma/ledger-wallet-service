#  Full Stack Engineer – Advanced Technical Case Study (24 Hours)

## Important Note on AI Usage (Read Carefully)

You **may use AI tools (e.g. ChatGPT, Copilot)** to assist you.

However:

* You **must understand and be able to explain** every part of your solution
* Blind copy-paste solutions will be obvious and scored poorly

To make this explicit, this case study includes **reflection and reasoning requirements** that cannot be satisfied by copy-pasting a generic AI-generated answer.

We are evaluating **engineering judgment, trade-offs, and clarity of thinking**, not memorization.

---

## Context

You are building a **core ledger service** for a fintech-style application. This service is responsible for managing user balances and must be **correct, auditable, and safe under concurrency**.

This service is considered a **system of record** and will be integrated by multiple downstream systems.

---

## Problem Statement

Build a **Ledger-Based Wallet & Transfer Service** that allows users to:

1. Create a user
2. Maintain a wallet balance **derived strictly from a ledger**
3. Fund wallets via external payment references
4. Transfer funds between users
5. Query balances and transaction history

⚠️ **You may NOT store a mutable balance column** that is updated directly.
All balances must be derived from ledger entries.

---

## Core Requirements

### 1. Ledger Model (Mandatory)

Design a ledger system with the following properties:

* Every monetary movement is an immutable ledger entry
* Ledger entries are append-only
* Balance is computed as: `SUM(credits) - SUM(debits)`
* Ledger entries must reference:

  * A wallet
  * A transaction group or reference
  * Direction (credit/debit)

Example (not prescriptive):

* `ledger_entries`

  * id
  * wallet_id
  * amount
  * direction (credit | debit)
  * transaction_reference
  * created_at

---

### 2. Idempotency (Mandatory)

All write operations **must be idempotent**.

Requirements:

* Funding and transfers must accept an `Idempotency-Key` header
* Replaying the same request with the same key must:

  * Not create duplicate ledger entries
  * Return the original response

Explain:

* Where idempotency keys are stored
* How conflicts are handled
* Expiry or cleanup strategy

---

### 3. Atomic Transfers

Transfers must:

* Debit sender and credit receiver atomically
* Never allow partial completion
* Be safe under concurrent requests

You must explain:

* Transaction isolation strategy
* Locking or ordering assumptions
* Failure scenarios and recovery

---

### 4. API Requirements

Minimum endpoints (flexible design):

* `POST /users`
* `GET /wallets/:userId/balance`
* `POST /transactions/fund`
* `POST /transactions/transfer`
* `GET /transactions?walletId=...`

All monetary values must use integer representation.

---

### 5. Data Integrity Rules

* Wallet balance must never go below zero
* Ledger entries are immutable
* Duplicate external payment references must not double-credit wallets
* Transfers must be traceable as a single logical operation

---

## Non-Functional Requirements

### Concurrency & Consistency (Required)

In your README, include a section titled:

> **"Concurrency & Consistency Guarantees"**

Answer in your own words:

* What happens if two transfers try to debit the same wallet at the same time?
* Why your approach is safe
* What database guarantees you rely on

Generic textbook answers will be scored poorly.

---

### Observability (Required)

* Structured logging for transactions
* A health check endpoint
* Clear error responses

---

### Security (Basic)

* Input validation
* No negative or zero-value transfers
* Brief explanation of how authentication *would* be added

---

## Frontend / Interface (Minimal)

Choose one:

* OpenAPI / Swagger documentation
* Postman collection
* Minimal UI (optional, not required)

Backend quality matters far more than UI.

---

## Required Engineering Reflection (MANDATORY)

Include a file named **`ENGINEERING_NOTES.md`** answering the following:

1. **Which part of this system was hardest to design, and why?**
2. **What is one decision you made that you would revisit in a real production system?**
3. **If transaction volume increased 100×, what would break first?**
4. **What did you intentionally *not* build, and why?**

Answers should be specific to *your* implementation.

---

## Deliverables

Provide:

1. Git repository
2. README with:

   * Setup instructions
   * Architecture overview
   * Concurrency & consistency section
3. Database schema / migrations
4. API implementation
5. `ENGINEERING_NOTES.md`

Optional bonuses:

* Tests around concurrency or idempotency
* Docker Compose setup
* Event-driven extension ideas

---

## Evaluation Criteria

### Backend Correctness (Primary)

* Ledger correctness
* Idempotency implementation
* Atomicity
* Edge-case handling

### Engineering Judgment

* Quality of trade-offs
* Real-world awareness
* Reflection depth

### Code Quality

* Readability
* Structure
* Naming

### Communication

* Clear explanations
* Non-generic reasoning

---

## Constraints

* Any language or framework
* No full end-to-end code generators
* AI assistance allowed, understanding required

---

## Time Expectation

This challenge is intentionally **harder than average**, but still scoped so a strong engineer can complete it within **24 hours**.

We value **thinking, correctness, and clarity** over feature count.

Good luck.
