import fs from "fs";
import path from "path";

const LOG_FILE = path.join(process.cwd(), "mcp_datadog.log");

const SENSITIVE_KEYS = ["apiKey", "appKey", "password", "secret", "token"];

/**
 * Recursively redact known secret keys in an object (for safe logging).
 * @param {*} value - Value to redact (object, array, or primitive)
 * @returns {*} Redacted copy; primitives unchanged
 */
function redactSecrets(value) {
  if (value == null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const keyLower = k.toLowerCase();
    if (SENSITIVE_KEYS.some((sk) => keyLower === sk.toLowerCase())) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redactSecrets(v);
    }
  }
  return out;
}

export class Logger {
  static log(component, message, data = null) {
    const timestamp = new Date().toISOString();
    let logLine = `[${timestamp}] [${component}] ${message}`;

    if (data) {
      logLine += ` ${JSON.stringify(redactSecrets(data))}`;
    }

    fs.appendFileSync(LOG_FILE, logLine + "\n");
  }

  static error(component, message, error) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${component}] ERROR: ${message} - ${error?.message || error}`;
    fs.appendFileSync(LOG_FILE, logLine + "\n");
  }

  static clear() {
    fs.writeFileSync(LOG_FILE, "");
  }
}
