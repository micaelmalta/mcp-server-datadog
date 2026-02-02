import { config } from "dotenv";
import { beforeEach, afterEach, vi } from "vitest";
import { installMockFetch, clearMocks } from "./helpers.js";
import "./mocks/datadogApi.js";

// Load environment variables from .env.example for testing
config({ path: ".env.example" });

// Set up test environment variables
process.env.NODE_ENV = "test";
process.env.DATADOG_API_KEY = "test-api-key";
process.env.DATADOG_APP_KEY = "test-app-key";
process.env.DATADOG_SITE = "datadoghq.com";
process.env.DATADOG_REGION = "us1";

// Global test timeout
globalThis.TEST_TIMEOUT = 5000;

// Install mock fetch globally for all tests
installMockFetch();

// Setup function that runs before each test
beforeEach(() => {
  // Clear mock state before each test
  clearMocks();
});

// Cleanup function that runs after each test
afterEach(() => {
  // Clear any lingering mock state
  clearMocks();
});
