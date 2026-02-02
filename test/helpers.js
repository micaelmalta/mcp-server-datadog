/**
 * Test helpers and mock utilities for mcp_datadog tests.
 * Provides mock HTTP responses, fetch mocking, and common test utilities.
 */

/**
 * Mock fetch responses for testing.
 * Stores mock responses to be returned by fetch calls.
 */
/**
 * Import Vitest functions for use in this module.
 * This is needed since helpers module needs to use vi mock functions.
 */
import { vi } from "vitest";

let mockFetchResponse = null;
let mockFetchError = null;

/**
 * Set up a successful mock fetch response.
 * @param {Object} responseData - The data to return from fetch
 * @param {number} status - HTTP status code (default: 200)
 */
export function mockSuccess(responseData, status = 200) {
  mockFetchResponse = {
    ok: status >= 200 && status < 300,
    status,
    statusText:
      status === 200
        ? "OK"
        : status === 201
          ? "Created"
          : status === 400
            ? "Bad Request"
            : status === 401
              ? "Unauthorized"
              : status === 403
                ? "Forbidden"
                : status === 404
                  ? "Not Found"
                  : status === 429
                    ? "Too Many Requests"
                    : "Error",
    json: async () => responseData,
  };
  mockFetchError = null;
}

/**
 * Set up a failed mock fetch response.
 * @param {Object} config - Error configuration
 * @param {number} config.status - HTTP status code
 * @param {string} config.message - Error message
 * @param {Object} config.errorData - Error response data
 */
export function mockError(config) {
  const { status = 500, message = "Server Error", errorData = {} } = config;
  mockFetchResponse = {
    ok: false,
    status,
    statusText: message,
    json: async () => errorData || { errors: [message] },
  };
  mockFetchError = null;
}

/**
 * Set up a timeout error for fetch.
 */
export function mockTimeout() {
  mockFetchError = new DOMException("The operation was aborted.", "AbortError");
  mockFetchResponse = null;
}

/**
 * Set up a network error for fetch.
 */
export function mockNetworkError() {
  mockFetchError = new Error("Failed to fetch");
  mockFetchResponse = null;
}

/**
 * Install mock fetch globally for tests.
 * This should be called in test setup.
 */
export function installMockFetch() {
  globalThis.fetch = vi.fn(async (_url, _options) => {
    if (mockFetchError) {
      throw mockFetchError;
    }

    if (mockFetchResponse) {
      return mockFetchResponse;
    }

    // Default: return 404 if no mock is set
    return {
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ errors: ["No mock response configured"] }),
    };
  });
}

/**
 * Clear all mock responses.
 */
export function clearMocks() {
  mockFetchResponse = null;
  mockFetchError = null;
  if (globalThis.fetch && globalThis.fetch.mockClear) {
    globalThis.fetch.mockClear();
  }
}

/**
 * Get the fetch mock object for inspection.
 */
export function getFetchMock() {
  return globalThis.fetch;
}

/**
 * Create a mock Datadog client configuration.
 */
export function createMockConfig() {
  return {
    apiKey: "test-api-key-1234567890",
    appKey: "test-app-key-0987654321",
    site: "datadoghq.com",
  };
}

/**
 * Assert that the fetch mock was called with expected parameters.
 * @param {string} method - Expected HTTP method
 * @param {string} url - Expected URL (partial match)
 * @param {Object} options - Additional checks
 */
export function assertFetchCalled(method, url, options = {}) {
  const mockFetch = getFetchMock();
  expect(mockFetch).toHaveBeenCalled();

  const calls = mockFetch.mock.calls;
  const found = calls.some((call) => {
    const [callUrl, callOptions] = call;
    const urlMatch = callUrl.includes(url);
    const methodMatch = !options.method || callOptions.method === options.method;
    return urlMatch && methodMatch;
  });

  expect(found).toBe(true);
}

/**
 * Get the last fetch call arguments.
 */
export function getLastFetchCall() {
  const mockFetch = getFetchMock();
  const calls = mockFetch.mock.calls;
  return calls[calls.length - 1] || [];
}

/**
 * Create sample timestamp values for testing.
 */
export function createTestTimestamps() {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 86400; // 24 hours ago

  return {
    from,
    to,
    fromMs: from * 1000,
    toMs: to * 1000,
    fromIso: new Date(from * 1000).toISOString(),
    toIso: new Date(to * 1000).toISOString(),
  };
}

/**
 * Verify that a response follows the standard { data, error } pattern.
 * @param {*} response - The response to verify
 * @param {boolean} expectError - Whether an error is expected
 */
export function assertValidResponse(response, expectError = false) {
  expect(response).toBeDefined();
  expect(response).toHaveProperty("data");
  expect(response).toHaveProperty("error");

  if (expectError) {
    expect(response.error).toBeDefined();
    expect(response.data).toBeNull();
  } else {
    expect(response.error).toBeNull();
    expect(response.data).toBeDefined();
  }
}

/**
 * Create a mock API client for testing.
 * Useful for testing tools without testing the client itself.
 */
export class MockApiClient {
  constructor(responses = {}) {
    this.responses = responses;
    this.lastRequest = null;
  }

  async get(path, config) {
    this.lastRequest = { method: "GET", path, config };
    const response = this.responses[path];
    if (response instanceof Error) {
      throw response;
    }
    return response || { data: null, error: null };
  }

  async post(path, data, config) {
    this.lastRequest = { method: "POST", path, data, config };
    const response = this.responses[path];
    if (response instanceof Error) {
      throw response;
    }
    return response || { data: null, error: null };
  }

  async put(path, data, config) {
    this.lastRequest = { method: "PUT", path, data, config };
    const response = this.responses[path];
    if (response instanceof Error) {
      throw response;
    }
    return response || { data: null, error: null };
  }
}
