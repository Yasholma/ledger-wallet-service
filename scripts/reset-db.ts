import { Pool } from "pg";
import dotenv from "dotenv";
import { execSync } from "child_process";

// Load environment variables
dotenv.config();

// Safety check: Only allow reset in development/local environments
if (process.env.NODE_ENV === "production") {
  console.error(
    "ERROR: Database reset is not allowed in production environment!"
  );
  console.error(
    "This script can only be run in development or when NODE_ENV is not set to 'production'."
  );
  process.exit(1);
}

// Additional safety: Check database name to prevent accidental production resets
const dbName = process.env.DB_NAME || "ledger_wallet_db";
if (dbName.includes("prod") || dbName.includes("production")) {
  console.error(
    `ERROR: Database name "${dbName}" suggests a production database!`
  );
  console.error("This script can only be run on development/test databases.");
  console.error(
    "If you're sure this is safe, set ALLOW_PRODUCTION_RESET=true (not recommended)."
  );

  if (process.env.ALLOW_PRODUCTION_RESET !== "true") {
    process.exit(1);
  }
  console.warn(
    "WARNING: Production reset allowed via ALLOW_PRODUCTION_RESET flag!"
  );
}

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: dbName,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
});

async function resetDatabase() {
  const client = await pool.connect();
  try {
    console.log("Dropping all tables and types...");

    // Drop tables in reverse dependency order
    await client.query("DROP TABLE IF EXISTS ledger_entries CASCADE");
    await client.query("DROP TABLE IF EXISTS transfers CASCADE");
    await client.query("DROP TABLE IF EXISTS idempotency_keys CASCADE");
    await client.query("DROP TABLE IF EXISTS wallets CASCADE");
    await client.query("DROP TABLE IF EXISTS users CASCADE");
    await client.query("DROP TABLE IF EXISTS pgmigrations CASCADE");

    // Drop ENUM types (they persist after table drops)
    await client.query("DROP TYPE IF EXISTS transfer_status CASCADE");
    await client.query("DROP TYPE IF EXISTS ledger_direction CASCADE");

    console.log("All tables dropped successfully.");

    // Run migrations
    console.log("Running migrations...");
    execSync("node-pg-migrate up", {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ||
          `postgresql://${process.env.DB_USER || "postgres"}:${
            process.env.DB_PASSWORD || "postgres"
          }@${process.env.DB_HOST || "localhost"}:${
            process.env.DB_PORT || "5432"
          }/${process.env.DB_NAME || "ledger_wallet_db"}`,
      },
      cwd: process.cwd(),
    });

    console.log("Database reset complete!");
  } catch (error) {
    console.error("Error resetting database:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

resetDatabase();
