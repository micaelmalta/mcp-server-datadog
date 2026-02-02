import { config } from "dotenv";
import { MissingEnvironmentVariable } from "./errors.js";

// Load environment variables from .env file if it exists
config();

/**
 * Load a required environment variable.
 * @param {string} key - The environment variable key
 * @returns {string} The environment variable value
 * @throws {MissingEnvironmentVariable} If the variable is not set
 */
export function loadEnvironmentVariable(key) {
  const value = process.env[key];
  if (!value) {
    throw new MissingEnvironmentVariable(
      `Required environment variable "${key}" is not set`
    );
  }
  return value;
}

/**
 * Load an optional environment variable with a default value.
 * @param {string} key - The environment variable key
 * @param {string} defaultValue - The default value if not set
 * @returns {string} The environment variable value or default
 */
export function loadOptionalEnvironmentVariable(key, defaultValue) {
  return process.env[key] || defaultValue;
}

/**
 * Load and validate all required Datadog configuration.
 * @returns {Object} Configuration object with all required and optional variables
 * @throws {MissingEnvironmentVariable} If required variables are missing
 */
export function getConfiguration() {
  return {
    datadogApiKey: loadEnvironmentVariable("DATADOG_API_KEY"),
    datadogAppKey: loadEnvironmentVariable("DATADOG_APP_KEY"),
    datadogSite: loadOptionalEnvironmentVariable("DATADOG_SITE", "datadoghq.com"),
    datadogRegion: loadOptionalEnvironmentVariable("DATADOG_REGION", "us1"),
    nodeEnv: loadOptionalEnvironmentVariable("NODE_ENV", "local"),
    mcpServerName: loadOptionalEnvironmentVariable("MCP_SERVER_NAME", "datadog"),
    mcpServerVersion: loadOptionalEnvironmentVariable(
      "MCP_SERVER_VERSION",
      "1.0.0"
    ),
  };
}
