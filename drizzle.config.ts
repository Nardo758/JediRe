import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

export default {
  schema: "./shared/schema.ts",
  out: "./database/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/agent_dashboard",
  },
  verbose: true,
  strict: true,
} satisfies Config;
