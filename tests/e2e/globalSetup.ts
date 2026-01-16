// Global setup that runs once before all e2e tests
// IMPORTANT: This runs BEFORE any test files are loaded, so env vars are set before app imports
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";
import { execSync } from "child_process";

// Load .env.test file if it exists FIRST
dotenv.config({ path: path.join(process.cwd(), ".env.test") });

// Set test environment variables (with defaults) BEFORE any app imports
// This ensures the app's database.ts uses the test database when it's imported
process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "ledger_wallet_test";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_PORT = process.env.DB_PORT || "5432";
process.env.DB_USER = process.env.DB_USER || "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "postgres";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "silent";

// Create a test database pool
const testPool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "ledger_wallet_test",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  max: 5,
});

/**
 * Run migrations on the test database
 */
async function runMigrations() {
  const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || "5432",
    database: process.env.DB_NAME || "ledger_wallet_test",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
  };

  // Build connection string for migrations
  const connectionString =
    process.env.DATABASE_URL ||
    `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

  // Set environment variables for migration
  const env = {
    ...process.env,
    DB_HOST: dbConfig.host,
    DB_PORT: dbConfig.port,
    DB_NAME: dbConfig.database,
    DB_USER: dbConfig.user,
    DB_PASSWORD: dbConfig.password,
    DATABASE_URL: connectionString,
  };

    // Run migrations using node-pg-migrate
    try {
      const migrationCmd = `node-pg-migrate up --migrations-dir migrations`;
      execSync(migrationCmd, {
        env,
        stdio: "inherit", // Show output for debugging
        cwd: process.cwd(),
        encoding: "utf8",
      });

      // Verify tables exist after migration (no delay needed - migrations are synchronous)
      const checkResult = await testPool.query("SELECT 1 FROM users LIMIT 1");
      if (!checkResult.rows.length) {
        throw new Error("Migrations ran but users table still doesn't exist");
      }

      console.log("[E2E Global Setup] Migrations completed successfully.");
  } catch (execError: any) {
    const stderr = execError.stderr?.toString() || execError.stderr || "";
    const stdout = execError.stdout?.toString() || execError.stdout || "";
    const errorMsg = execError.message || "";

    throw new Error(
      `Migration command failed:\n${errorMsg}\n` +
        (stdout ? `STDOUT: ${stdout}\n` : "") +
        (stderr ? `STDERR: ${stderr}\n` : "") +
        `Database: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}\n` +
        `User: ${dbConfig.user}`
    );
  }
}

export default async function globalSetup() {
  console.log("\n[E2E Global Setup] Starting e2e test setup...");

  // Check if tables exist, if not run migrations automatically
  try {
    await testPool.query("SELECT 1 FROM users LIMIT 1");
    console.log(
      "[E2E Global Setup] Database tables already exist. Skipping migrations."
    );
  } catch (error: any) {
    if (error.code === "42P01") {
      // Tables don't exist, run migrations automatically
      console.log(
        `[E2E Global Setup] Database tables not found. Running migrations...\n` +
          `Database: ${process.env.DB_NAME || "ledger_wallet_test"}@${
            process.env.DB_HOST || "localhost"
          }\n`
      );
      await runMigrations();
    } else {
      await testPool.end();
      throw error;
    }
  }

  await testPool.end();
  console.log("[E2E Global Setup] Setup completed.\n");
}
