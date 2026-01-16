// E2E test setup (runs for each test file)
// IMPORTANT: This must run BEFORE any app imports to ensure the app uses test database
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

// Load .env.test file if it exists FIRST
dotenv.config({ path: path.join(process.cwd(), ".env.test") });

// Set test environment variables (with defaults) BEFORE any app imports
// This ensures the app's database.ts uses the test database
process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "ledger_wallet_test";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_PORT = process.env.DB_PORT || "5432";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "silent";

// Note: Module cache clearing is done in globalSetup to ensure it happens
// before test files are loaded and import the app

// Create a test database pool using environment variables from .env.test
export const testPool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "ledger_wallet_test",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  max: 5,
});

// Cleanup function to run after all tests in each test file
export async function cleanupDatabase() {
  // Truncate all tables (preserves schema, removes data)
  // Only truncate if tables exist (graceful handling)
  const tables = [
    "ledger_entries",
    "transfers",
    "idempotency_keys",
    "wallets",
    "users",
  ];

  // Use DELETE instead of TRUNCATE to avoid deadlocks with open transactions
  for (const table of tables) {
    try {
      await testPool.query(`DELETE FROM ${table}`);
    } catch (error: any) {
      // Ignore errors if table doesn't exist (e.g., migrations not run)
      if (error.code !== "42P01") {
        throw error;
      }
    }
  }
}

// Setup before all tests in each test file
// Migrations are handled in globalSetup, so we just verify connection
beforeAll(async () => {
  // Verify that environment variables are set correctly
  // This ensures the app's database.ts uses the test database
  const expectedDbName = process.env.DB_NAME || "ledger_wallet_test";
  if (!process.env.DB_NAME || process.env.DB_NAME !== expectedDbName) {
    console.warn(
      `[E2E Setup] Warning: DB_NAME is "${process.env.DB_NAME}", expected "${expectedDbName}"`
    );
  }

  // Clear module cache AFTER test files are loaded to force re-import with correct env vars
  // This ensures the app's database pool uses the test database
  // IMPORTANT: Clear in reverse dependency order to ensure all modules are re-imported
  const moduleCacheKeys = Object.keys(require.cache).filter(
    (key) =>
      key.includes("config/database") ||
      key.includes("src/app") ||
      key.includes("src/services") ||
      key.includes("src/routes") ||
      key.includes("src/middleware")
  );
  if (moduleCacheKeys.length > 0) {
    console.log(
      `[E2E Setup] Clearing cache for ${moduleCacheKeys.length} modules to ensure test database is used`
    );
    // Clear in reverse order to handle dependencies properly
    moduleCacheKeys.forEach((key) => {
      delete require.cache[key];
    });
  }

  // Force a fresh import of the database module to ensure the pool is recreated
  // This ensures all services that import pool will get the correct instance
  delete require.cache[require.resolve("../../src/config/database")];

  // Verify that the app's database pool is using the test database
  // Import the pool after clearing cache to ensure it uses the correct env vars
  // This import ensures the pool is created with the correct config
  const { pool: appPool } = await import("../../src/config/database");

  // Also import the app to ensure it's using the correct pool
  // This forces the app and services to be imported with the correct pool
  // Export it so tests can use it
  // IMPORTANT: Always create a fresh app instance for each test file
  // to avoid state leakage between test files
  const appModule = await import("../../src/app");
  (global as any).__TEST_APP__ = appModule.default;

  // Query the database name from PostgreSQL to verify connection
  try {
    const dbNameResult = await appPool.query(
      "SELECT current_database() as db_name"
    );
    const appDbName = dbNameResult.rows[0].db_name;
    const expectedDbName = process.env.DB_NAME || "ledger_wallet_test";

    if (appDbName !== expectedDbName) {
      console.error(
        `[E2E Setup] ERROR: App pool is connected to "${appDbName}", expected "${expectedDbName}"`
      );
      throw new Error(
        `Database mismatch: App is using "${appDbName}" but tests expect "${expectedDbName}". ` +
          `This means the app's database pool was created with the wrong environment variables.`
      );
    } else {
      console.log(
        `[E2E Setup] Verified: App pool is connected to test database "${appDbName}"`
      );
    }
  } catch (error: any) {
    console.error(
      "[E2E Setup] Failed to verify app database connection:",
      error.message
    );
    throw error;
  }

  // Verify database connection and tables exist
  // Migrations should have been run in globalSetup
  try {
    await testPool.query("SELECT 1 FROM users LIMIT 1");
  } catch (error: any) {
    if (error.code === "42P01") {
      throw new Error(
        "Database tables do not exist. Migrations should have run in globalSetup.\n" +
          "This is likely a configuration issue. Check that globalSetup is running."
      );
    }
    throw error;
  }
});

// Cleanup after all tests in each test file
// Global teardown handles migration rollback if enabled
afterAll(async () => {
  await cleanupDatabase();
  // Note: testPool.end() is NOT called here because it's shared across test files
  // It will be closed in globalTeardown
});
