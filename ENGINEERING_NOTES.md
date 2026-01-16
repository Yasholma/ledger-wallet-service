# Engineering Notes

## 1. Which part of this system was hardest to design, and why?

The hardest part by far was the **idempotency middleware**.

On the surface it sounds simple — “don’t process the same request twice” — but once you get into the details, it gets tricky fast. The main issue was **race conditions**. If two identical requests with the same idempotency key hit the system at the same time, you really want only one of them to actually do the work, while both return the exact same response. My first instinct was the classic “check if the key exists, then insert if it doesn’t”, but that leaves a race window where both requests can pass the check and both get processed.

The real fix was pushing that responsibility down to the database and letting it handle it atomically using `INSERT … ON CONFLICT`. That way, only one request “wins”, and the others can safely read the stored response.

Another awkward part was **capturing the response**. Since this is Express, the middleware has to somehow intercept whatever the route handler sends back so it can store it. That meant wrapping `res.status()` and `res.json()` to grab the payload before it’s sent. It works, but it’s not exactly pretty — it feels a bit fragile — though in practice it’s the most realistic way to do it at this layer.

Finally, there’s the issue of someone reusing the same idempotency key with a **different request body**. To detect that, I hash the request body in a deterministic way (sorted keys, etc.) and compare it against what was stored previously. Handling that conflict cleanly — especially once a response already exists — took a bit of care.

---

## 2. What is one decision you made that you would revisit in a production system?

I’d definitely revisit **how idempotency responses are stored**.

Right now, the full response body is stored in Postgres as JSONB. That’s fine for a demo or a small system, but at scale it’s going to hurt. Large responses plus high request volume will blow up table size pretty quickly, and large JSONB columns aren’t great for performance either.

In a real production setup, I’d split responsibilities:

- Store metadata and hashes in Postgres
- Store the actual response bodies in something like Redis
- Put a TTL on those cache entries
- Fall back to the database only if the cache misses

That gives you faster reads for the common case and keeps the database lean.

I’d also add a proper background cleanup job for expired idempotency keys and some basic metrics (hit rate, conflict rate, etc.) so we can actually see how the feature is behaving in the wild.

---

## 3. If transaction volume increased 100×, what would break first?

A few things would start to hurt, but the **balance calculation** would probably be the first real problem.

Right now, balances are calculated by running a `SUM()` over all ledger entries for a wallet. That’s nice and correct, but as the ledger grows, that query just keeps getting slower. With 100× more transactions, the ledger grows 100× faster, and suddenly every balance check becomes expensive.

Other pressure points would show up too:

- The database connection pool would get exhausted very quickly at its current size
- The idempotency table would grow much faster and start impacting insert and lookup performance
- Transfers involving “hot” wallets would experience more lock contention and retries
- The API layer would need horizontal scaling to keep up with request volume

But the balance query is the one that’s both read-heavy and data-growth-sensitive, so it’s the most obvious early bottleneck.

In production, I’d probably introduce balance snapshots or materialized views, even if that slightly compromises the “pure ledger” approach, or at least use a hybrid model.

---

## 4. What did you intentionally _not_ build, and why?

Quite a few things, mostly because I wanted to keep the focus on correctness and core behavior:

- No balance caching or snapshots, even though it would help performance
- No retry logic for failed transfers or deadlocks — failures return immediately
- No event publishing for downstream systems or webhook notifications
- No rate limiting
- No admin or operational endpoints
- No metrics or monitoring
- No comprehensive test suite (mostly unit and e2e tests, no load tests)
- Single-currency only (no multi-currency wallets)
- No transaction fees
- No dedicated audit log for compliance or regulatory requirements
