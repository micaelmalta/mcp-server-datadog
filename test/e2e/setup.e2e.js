/**
 * E2E test setup. Loads real .env (no SDK mock).
 * Run with: npm run test:e2e
 */

import { config } from "dotenv";

config({ path: ".env" });
process.env.NODE_ENV = "test";
