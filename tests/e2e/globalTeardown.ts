import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";
import { execSync } from "child_process";

dotenv.config({ path: path.join(process.cwd(), ".env.test") });

process.env.NODE_ENV = "test";
process.env.DB_NAME = process.env.DB_NAME || "ledger_wallet_test";

const testPool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "ledger_wallet_test",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  max: 5,
});

async function rollbackMigrations() {
  if (process.env.E2E_ROLLBACK_MIGRATIONS !== "true") {
    return;
  }

  try {
    const dbConfig = {
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || "5432",
      database: process.env.DB_NAME || "ledger_wallet_test",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
    };

    const connectionString =
      process.env.DATABASE_URL ||
      `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

    const env = {
      ...process.env,
      DB_HOST: dbConfig.host,
      DB_PORT: dbConfig.port,
      DB_NAME: dbConfig.database,
      DB_USER: dbConfig.user,
      DB_PASSWORD: dbConfig.password,
      DATABASE_URL: connectionString,
    };

    execSync("node-pg-migrate down --to 0", {
      env,
      stdio: "pipe",
      cwd: process.cwd(),
    });
    console.log("[E2E Global Teardown] Migrations rolled back.");
  } catch (error: any) {
    console.warn(
      `[E2E Global Teardown] Failed to rollback migrations: ${error.message}`
    );
  }
}

export default async function globalTeardown() {
  console.log("\n[E2E Global Teardown] Starting cleanup...");

  await rollbackMigrations();

  try {
    const cacheKeys = Object.keys(require.cache).filter((key) =>
      key.includes("config/database")
    );
    cacheKeys.forEach((key) => delete require.cache[key]);

    const dbModulePath = require.resolve("../../src/config/database");
    delete require.cache[dbModulePath];

    const { pool: appPool } = await import("../../src/config/database");
    if (appPool && typeof appPool.end === "function") {
      await appPool.end();
      console.log("[E2E Global Teardown] App database pool closed.");
    }
  } catch (error: any) {
    console.warn(
      `[E2E Global Teardown] Could not close app pool: ${error.message}`
    );
  }

  try {
    await testPool.end();
    console.log("[E2E Global Teardown] Test database pool closed.");
  } catch (error: any) {
    console.warn(
      `[E2E Global Teardown] Could not close test pool: ${error.message}`
    );
  }

  console.log("[E2E Global Teardown] Cleanup completed.\n");

  process.exit(0);
}
