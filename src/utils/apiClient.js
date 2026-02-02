import { DatadogClientError } from "./errors.js";

/**
 * Generic HTTP API client for making requests to external APIs.
 * Follows the error handling pattern used in the monorepo.
 */
export class ApiClient {
  /**
   * @param {Object} config - Client configuration
   * @param {string} config.baseUrl - Base URL for all requests
   * @param {Object} config.headers - Default headers to include
   * @param {number} config.timeout - Request timeout in milliseconds
   */
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || "";
    this.headers = config.headers || {};
    this.timeout = config.timeout || 30000;
  }

  /**
   * Make a GET request.
   * @param {string} path - The API path (appended to baseUrl)
   * @param {Object} config - Optional request configuration
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async get(path, config = {}) {
    try {
      const response = await this._request("GET", path, null, config);
      return { data: response, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Make a POST request.
   * @param {string} path - The API path (appended to baseUrl)
   * @param {Object} data - Request body data
   * @param {Object} config - Optional request configuration
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async post(path, data = {}, config = {}) {
    try {
      const response = await this._request("POST", path, data, config);
      return { data: response, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Make a PUT request.
   * @param {string} path - The API path (appended to baseUrl)
   * @param {Object} data - Request body data
   * @param {Object} config - Optional request configuration
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async put(path, data = {}, config = {}) {
    try {
      const response = await this._request("PUT", path, data, config);
      return { data: response, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Internal method to make HTTP requests using fetch.
   * @private
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object} body - Request body (null for GET)
   * @param {Object} config - Request configuration
   * @returns {Promise<Object>} Response data
   * @throws {DatadogClientError} If the request fails
   */
  async _request(method, path, body, config = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      ...this.headers,
      ...config.headers,
      "Content-Type": "application/json",
    };

    const options = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeout),
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new DatadogClientError(
          errorData.error?.message ||
            `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          new Error(JSON.stringify(errorData))
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof DatadogClientError) {
        throw error;
      }

      if (error.name === "AbortError") {
        throw new DatadogClientError(
          `Request timeout after ${this.timeout}ms`,
          null,
          error
        );
      }

      throw new DatadogClientError(
        error.message || "Unknown request error",
        null,
        error
      );
    }
  }
}
