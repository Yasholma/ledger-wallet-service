// Import app's pool dynamically to ensure it uses test database config
// IMPORTANT: We need to use the SAME pool instance that the services use
// Cache the pool but refresh it when module cache is cleared
let cachedPool: any = null;
async function getAppPool() {
  // Cache the pool for performance, but it will be refreshed when
  // module cache is cleared in setup.ts beforeAll
  if (!cachedPool) {
    const dbModule = await import("../../src/config/database");
    cachedPool = dbModule.pool;
  }
  return cachedPool;
}

/**
 * Helper to create a test user and wallet
 * Returns both user and wallet ID
 * Uses app's pool to ensure data is visible to the app
 */
export async function createTestUser(email: string, name: string) {
  const pool = await getAppPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Create user
    const userResult = await client.query(
      `INSERT INTO users (email, name) 
       VALUES ($1, $2) 
       RETURNING id, email, name, created_at`,
      [email, name]
    );

    const user = userResult.rows[0];

    // Create wallet for user and return the wallet ID
    const walletResult = await client.query(
      `INSERT INTO wallets (user_id)
       VALUES ($1)
       RETURNING id`,
      [user.id]
    );

    const walletId = walletResult.rows[0].id;

    await client.query("COMMIT");
    return { ...user, walletId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Helper to get a user's wallet ID
 * Uses app's pool to ensure consistency
 */
export async function getWalletId(userId: string) {
  const pool = await getAppPool();
  const result = await pool.query("SELECT id FROM wallets WHERE user_id = $1", [
    userId,
  ]);
  return result.rows[0]?.id;
}

/**
 * Helper to get wallet balance directly from database
 * Uses app's pool to ensure consistency
 */
export async function getWalletBalance(walletId: string): Promise<number> {
  const pool = await getAppPool();
  const result = await pool.query(
    `SELECT 
      COALESCE(SUM(amount) FILTER (WHERE direction = 'credit'), 0) -
      COALESCE(SUM(amount) FILTER (WHERE direction = 'debit'), 0) as balance
    FROM ledger_entries
    WHERE wallet_id = $1`,
    [walletId]
  );
  return parseInt(result.rows[0]?.balance || "0", 10);
}

/**
 * Helper to count ledger entries for a wallet
 * Uses app's pool to ensure consistency
 */
export async function countLedgerEntries(walletId: string): Promise<number> {
  const pool = await getAppPool();
  const result = await pool.query(
    "SELECT COUNT(*) as count FROM ledger_entries WHERE wallet_id = $1",
    [walletId]
  );
  return parseInt(result.rows[0]?.count || "0", 10);
}

/**
 * Helper to cleanup test data
 * Gracefully handles missing tables (e.g., if migrations haven't been run)
 * Uses TRUNCATE for faster cleanup (much faster than DELETE)
 * Uses app's pool to ensure consistency
 */
export async function cleanupTestData() {
  const pool = await getAppPool();
  const client = await pool.connect();
  try {
    // Use TRUNCATE for much faster cleanup
    // CASCADE ensures foreign key constraints are handled automatically
    // RESTART IDENTITY resets auto-increment sequences
    const tables = [
      "ledger_entries",
      "transfers",
      "idempotency_keys",
      "wallets",
      "users",
    ];

    // Truncate all tables in one command for better performance
    // CASCADE handles foreign key dependencies automatically
    const tableList = tables.join(", ");
    try {
      await client.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
    } catch (error: any) {
      // If TRUNCATE fails (e.g., due to open transactions), fall back to DELETE
      if (error.code === "40P01" || error.message?.includes("lock")) {
        // Fallback to DELETE if TRUNCATE fails due to locks
        await client.query("BEGIN");
        for (const table of tables) {
          try {
            await client.query(`DELETE FROM ${table}`);
          } catch (deleteError: any) {
            if (deleteError.code !== "42P01") {
              await client.query("ROLLBACK");
              throw deleteError;
            }
          }
        }
        await client.query("COMMIT");
      } else if (error.code !== "42P01") {
        // Re-throw if it's not a "table doesn't exist" error
        throw error;
      }
    }
  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
}
