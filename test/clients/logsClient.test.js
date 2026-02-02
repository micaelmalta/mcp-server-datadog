/**
 * Tests for Datadog Logs API client.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { LogsClient } from "#clients/logsClient.js";
import {
  mockSuccess,
  mockError,
  clearMocks,
  createMockConfig,
  createTestTimestamps,
  assertValidResponse,
  getLastFetchCall,
} from "#test/helpers.js";
import { logsSearchResponse, errorResponse } from "#test/fixtures/datadogResponses.js";

describe("LogsClient", () => {
  let client;
  let timestamps;

  beforeEach(() => {
    clearMocks();
    client = new LogsClient(createMockConfig());
    timestamps = createTestTimestamps();
  });

  describe("searchLogs", () => {
    it("should search logs successfully", async () => {
      mockSuccess(logsSearchResponse);

      const { data, error } = await client.searchLogs(
        "service:api status:error",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should include filter in request", async () => {
      mockSuccess(logsSearchResponse);

      await client.searchLogs(
        "service:api status:error",
        timestamps.fromMs,
        timestamps.toMs
      );

      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.filter.query).toBe("service:api status:error");
    });

    it("should handle empty filter query", async () => {
      mockSuccess(logsSearchResponse);

      const { data, error } = await client.searchLogs(
        "",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.filter.query).toBe("");
    });

    it("should handle default page size", async () => {
      mockSuccess(logsSearchResponse);

      await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.page.limit).toBe(10);
    });

    it("should include custom page size", async () => {
      mockSuccess(logsSearchResponse);

      await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        50
      );

      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.page.limit).toBe(50);
    });

    it("should enforce maximum page size of 100", async () => {
      mockSuccess(logsSearchResponse);

      await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        150
      );

      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.page.limit).toBe(100);
    });

    it("should reject page size < 1", async () => {
      const { data, error } = await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        0
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Page size must be between 1 and 100");
    });

    it("should reject page size > 100", async () => {
      const { data, error } = await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        101
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Page size must be between 1 and 100");
    });

    it("should reject when from >= to", async () => {
      const { data, error } = await client.searchLogs(
        "service:api",
        timestamps.toMs,
        timestamps.fromMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Start time must be before end time");
    });

    it("should reject when from equals to", async () => {
      const { data, error } = await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.fromMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Start time must be before end time");
    });

    it("should handle API errors", async () => {
      mockError({ status: 401, message: "Unauthorized", errorData: errorResponse });

      const { data, error } = await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(401);
    });

    it("should handle 429 rate limit", async () => {
      mockError({
        status: 429,
        message: "Too Many Requests",
        errorData: { errors: ["Rate limit exceeded"] },
      });

      const { data: _data, error } = await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      expect(error.statusCode).toBe(429);
    });

    it("should include timestamp sorting", async () => {
      mockSuccess(logsSearchResponse);

      await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.sort).toBe("timestamp");
    });

    it("should floor timestamps", async () => {
      mockSuccess(logsSearchResponse);
      const fromFloat = timestamps.fromMs + 0.5;
      const toFloat = timestamps.toMs + 0.7;

      await client.searchLogs("service:api", fromFloat, toFloat);

      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.filter.from).toBe(Math.floor(fromFloat));
      expect(body.filter.to).toBe(Math.floor(toFloat));
    });
  });

  describe("getLogDetails", () => {
    it("should get log details successfully", async () => {
      mockSuccess({
        data: {
          id: "AXvj0ZDn5d08oxCb7t9q",
          type: "logs",
          attributes: {
            timestamp: 1609459200000,
            message: "Test log entry",
          },
        },
      });

      const { data, error } = await client.getLogDetails("AXvj0ZDn5d08oxCb7t9q");

      assertValidResponse({ data, error }, false);
      expect(data.data).toBeDefined();
    });

    it("should encode log ID in URL", async () => {
      mockSuccess({ data: {} });

      await client.getLogDetails("AXvj0ZDn5d08oxCb7t9q");

      const [url] = getLastFetchCall();
      expect(url).toContain("AXvj0ZDn5d08oxCb7t9q");
    });

    it("should handle special characters in log ID", async () => {
      mockSuccess({ data: {} });
      const logId = "log+id/with=special?chars";

      await client.getLogDetails(logId);

      const [url] = getLastFetchCall();
      expect(url).toContain(encodeURIComponent(logId));
    });

    it("should reject empty log ID", async () => {
      const { data, error } = await client.getLogDetails("");

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Log ID is required");
    });

    it("should reject null log ID", async () => {
      const { data, error } = await client.getLogDetails(null);

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Log ID is required");
    });

    it("should handle 404 not found", async () => {
      mockError({ status: 404, message: "Not Found" });

      const { data, error } = await client.getLogDetails("nonexistent-id");

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(404);
    });

    it("should handle API errors", async () => {
      mockError({ status: 500, message: "Internal Server Error" });

      const { data, error } = await client.getLogDetails("AXvj0ZDn5d08oxCb7t9q");

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(500);
    });
  });

  describe("aggregateLogs", () => {
    it("should aggregate logs with avg", async () => {
      mockSuccess({ aggregation: { avg: 42.5 } });

      const { data, error } = await client.aggregateLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        "avg"
      );

      assertValidResponse({ data, error }, false);
      expect(data.aggregation).toBeDefined();
    });

    it("should aggregate logs with max", async () => {
      mockSuccess({ aggregation: { max: 100 } });

      const { data, error } = await client.aggregateLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        "max"
      );

      assertValidResponse({ data, error }, false);
    });

    it("should aggregate logs with min", async () => {
      mockSuccess({ aggregation: { min: 10 } });

      const { data, error } = await client.aggregateLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        "min"
      );

      assertValidResponse({ data, error }, false);
    });

    it("should aggregate logs with sum", async () => {
      mockSuccess({ aggregation: { sum: 5000 } });

      const { data, error } = await client.aggregateLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        "sum"
      );

      assertValidResponse({ data, error }, false);
    });

    it("should aggregate logs with cardinality", async () => {
      mockSuccess({ aggregation: { cardinality: 150 } });

      const { data, error } = await client.aggregateLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        "cardinality"
      );

      assertValidResponse({ data, error }, false);
    });

    it("should reject invalid aggregation type", async () => {
      const { data, error } = await client.aggregateLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        "invalid"
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Invalid aggregation type");
      expect(error.message).toContain("avg, max, min, sum, cardinality");
    });

    it("should reject missing aggregation type", async () => {
      const { data, error } = await client.aggregateLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        null
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Aggregation type is required");
    });

    it("should reject when from >= to", async () => {
      const { data, error } = await client.aggregateLogs(
        "service:api",
        timestamps.toMs,
        timestamps.fromMs,
        "avg"
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Start time must be before end time");
    });

    it("should include filter in aggregation request", async () => {
      mockSuccess({ aggregation: { avg: 50 } });

      await client.aggregateLogs(
        "service:api status:error",
        timestamps.fromMs,
        timestamps.toMs,
        "avg"
      );

      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.filter.query).toBe("service:api status:error");
    });

    it("should include aggregation type in request", async () => {
      mockSuccess({ aggregation: { avg: 50 } });

      await client.aggregateLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        "max"
      );

      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.aggs.aggregation.max).toBeDefined();
    });

    it("should handle empty filter with aggregation", async () => {
      mockSuccess({ aggregation: { sum: 1000 } });

      const { data, error } = await client.aggregateLogs(
        "",
        timestamps.fromMs,
        timestamps.toMs,
        "sum"
      );

      assertValidResponse({ data, error }, false);
    });

    it("should handle API errors during aggregation", async () => {
      mockError({ status: 400, message: "Bad Request" });

      const { data, error } = await client.aggregateLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        "avg"
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(400);
    });
  });

  describe("listIndexes", () => {
    it("should list log indexes successfully", async () => {
      mockSuccess({
        data: [
          {
            name: "main",
            daily_storage_gb: 100,
          },
          {
            name: "analytics",
            daily_storage_gb: 50,
          },
        ],
      });

      const { data, error } = await client.listIndexes();

      assertValidResponse({ data, error }, false);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should handle empty index list", async () => {
      mockSuccess({ data: [] });

      const { data, error } = await client.listIndexes();

      assertValidResponse({ data, error }, false);
      expect(data.data).toHaveLength(0);
    });

    it("should handle API errors", async () => {
      mockError({ status: 401, message: "Unauthorized" });

      const { data, error } = await client.listIndexes();

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(401);
    });
  });

  describe("API integration", () => {
    it("should use v2 API base URL", () => {
      expect(client.client.baseUrl).toBe("https://api.datadoghq.com/api/v2");
    });

    it("should include DD-API-KEY header", async () => {
      mockSuccess(logsSearchResponse);

      await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      const [, options] = getLastFetchCall();
      expect(options.headers["DD-API-KEY"]).toBe(createMockConfig().apiKey);
    });

    it("should include DD-APPLICATION-KEY header", async () => {
      mockSuccess(logsSearchResponse);

      await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      const [, options] = getLastFetchCall();
      expect(options.headers["DD-APPLICATION-KEY"]).toBe(
        createMockConfig().appKey
      );
    });

    it("should support custom site domain", () => {
      const customClient = new LogsClient({
        ...createMockConfig(),
        site: "datadoghq.eu",
      });

      expect(customClient.client.baseUrl).toBe("https://api.datadoghq.eu/api/v2");
    });
  });

  describe("error handling", () => {
    it("should handle validation errors", async () => {
      mockError({
        status: 400,
        message: "Bad Request",
        errorData: { errors: ["Invalid filter syntax"] },
      });

      const { data, error } = await client.searchLogs(
        "invalid:filter:",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(400);
    });

    it("should handle 500 errors", async () => {
      mockError({ status: 500, message: "Internal Server Error" });

      const { data, error } = await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(500);
    });

    it("should preserve error details", async () => {
      mockError({
        status: 403,
        message: "Forbidden",
        errorData: { errors: ["Insufficient permissions"] },
      });

      const { data: _data, error } = await client.listIndexes();

      expect(error.originalError).toBeDefined();
    });
  });

  describe("pagination", () => {
    it("should include pagination cursor in response", async () => {
      mockSuccess(logsSearchResponse);

      const { data } = await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        10
      );

      expect(data.meta).toBeDefined();
      expect(data.meta.page).toBeDefined();
      expect(data.meta.page.after).toBeDefined();
    });

    it("should include next page link in response", async () => {
      mockSuccess(logsSearchResponse);

      const { data } = await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        10
      );

      expect(data.links).toBeDefined();
      expect(data.links.next).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle very large timestamp values", async () => {
      mockSuccess(logsSearchResponse);
      const year2030From = 1893456000000; // 2030-01-01 in ms
      const year2030To = 1893542400000; // 2030-01-02 in ms

      const { data, error } = await client.searchLogs(
        "service:api",
        year2030From,
        year2030To
      );

      assertValidResponse({ data, error }, false);
    });

    it("should handle complex filter queries", async () => {
      mockSuccess(logsSearchResponse);
      const complexFilter =
        'service:api AND status:error AND (host:web-01 OR host:web-02)';

      const { data, error } = await client.searchLogs(
        complexFilter,
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
    });

    it("should handle unicode in filter", async () => {
      mockSuccess(logsSearchResponse);
      const unicodeFilter = "message:café";

      const { data, error } = await client.searchLogs(
        unicodeFilter,
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
    });
  });
});
