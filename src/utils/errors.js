/**
 * Error thrown when a Datadog API call fails.
 */
export class DatadogClientError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {Error} originalError - Original error object
   */
  constructor(message, statusCode = null, originalError = null) {
    super(message);
    this.name = "DatadogClientError";
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when a required environment variable is missing.
 */
export class MissingEnvironmentVariable extends Error {
  /**
   * @param {string} message - Error message
   */
  constructor(message) {
    super(message);
    this.name = "MissingEnvironmentVariable";
  }
}

/**
 * Error thrown when configuration is invalid.
 */
export class InvalidConfigurationError extends Error {
  /**
   * @param {string} message - Error message
   */
  constructor(message) {
    super(message);
    this.name = "InvalidConfigurationError";
  }
}
