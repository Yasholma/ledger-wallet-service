import { Pool, PoolConfig } from "pg";

const config: PoolConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "ledger_wallet_db",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const pool = new Pool(config);

pool.on("error", (err: Error) => {
  // eslint-disable-next-line no-console
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

export default pool;
