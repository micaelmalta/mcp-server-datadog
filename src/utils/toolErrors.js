/**
 * Helpers for actionable tool error messages (MCP best practices).
 * Error messages should guide agents with specific suggestions and next steps.
 */

/**
 * Format an error message with an actionable hint based on status code or content.
 * @param {string} message - Raw error message
 * @param {number} [statusCode] - HTTP status code if from API
 * @returns {string} Message with optional next-step hint
 */
export function formatToolError(message, statusCode) {
  const hint = getActionableHint(message, statusCode);
  return hint ? `${message} ${hint}` : message;
}

/**
 * Return a short actionable hint for common error cases.
 * @param {string} message - Error message (may be used for pattern matching)
 * @param {number} [statusCode] - HTTP status code
 * @returns {string} Hint string or empty if no hint
 * @private
 */
function getActionableHint(message, statusCode) {
  if (statusCode === 401 || statusCode === 403) {
    return "Check DATADOG_API_KEY and DATADOG_APP_KEY and that the app key has the required scopes.";
  }
  if (statusCode === 404) {
    return "No resource found. Check the ID or query and try again.";
  }
  if (statusCode === 429) {
    return "Datadog rate limit hit. Retry after a short delay or reduce request frequency.";
  }
  if (
    message &&
    (message.includes("must be before") ||
      message.includes("Start time") ||
      (message.includes("from") && message.includes("to")))
  ) {
    return "Ensure 'from' is before 'to'.";
  }
  if (message && message.includes("Invalid") && message.includes("format")) {
    return "Use Unix timestamp (seconds or ms) or ISO 8601 (e.g. 2021-01-01T00:00:00Z).";
  }
  return "";
}
