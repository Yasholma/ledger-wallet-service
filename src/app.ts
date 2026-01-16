import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { errorHandler } from "./middleware/errorHandler";
import { logger } from "./utils/logger";
import usersRouter from "./routes/users";
import walletsRouter from "./routes/wallets";
import transactionsRouter from "./routes/transactions";
import healthRouter from "./routes/health";

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? false
        : ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  })
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info("Incoming request", {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Swagger UI
const swaggerDocumentPath = path.join(process.cwd(), "openapi.yaml");
const swaggerDocument = YAML.load(swaggerDocumentPath);
// @ts-expect-error - swagger-ui-express has type conflicts with express types
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API Routes (must come before static file serving)
app.use("/users", usersRouter);
app.use("/wallets", walletsRouter);
app.use("/transactions", transactionsRouter);
app.use("/health", healthRouter);

// Serve static files from dist/public in production
if (process.env.NODE_ENV === "production") {
  const publicPath = path.join(process.cwd(), "dist", "public");
  app.use(express.static(publicPath));

  // Serve index.html for all non-API routes
  app.get("*", (req: Request, res: Response) => {
    if (
      req.path.startsWith("/users") ||
      req.path.startsWith("/wallets") ||
      req.path.startsWith("/transactions") ||
      req.path.startsWith("/health") ||
      req.path.startsWith("/api-docs")
    ) {
      return res.status(404).json({ error: "Not found" });
    }

    res.sendFile(path.join(publicPath, "index.html"));
  });
}

// Root endpoint (only in development, production serves frontend)
if (process.env.NODE_ENV !== "production") {
  app.get("/", (req: Request, res: Response) => {
    res.json({
      service: "Ledger Wallet Service",
      version: "1.0.0",
      endpoints: {
        users: "/users",
        wallets: "/wallets",
        transactions: "/transactions",
        health: "/health",
        apiDocs: "/api-docs",
      },
      note: "Frontend UI available at http://localhost:5173 in development",
    });
  });
}

// Error handler (must be last)
app.use(errorHandler);

// Start server
if (require.main === (module as NodeModule)) {
  app.listen(PORT, () => {
    logger.info(`Server started on port ${PORT}`, {
      port: PORT,
      environment: process.env.NODE_ENV || "development",
    });
  });
}

export default app;
