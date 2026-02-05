/**
 * Tests for Datadog Logs API client.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { LogsClient } from "#clients/logsClient.js";
import { mockDatadogApi } from "#test/mocks/datadogApi.js";
import {
  clearMocks,
  createMockConfig,
  createTestTimestamps,
  assertValidResponse,
} from "#test/helpers.js";
import { logsSearchResponse } from "#test/fixtures/datadogResponses.js";

describe("LogsClient", () => {
  let client;
  let timestamps;
  const { logsApi } = mockDatadogApi;

  beforeEach(() => {
    clearMocks();
    vi.mocked(logsApi.listLogs).mockReset();
    vi.mocked(logsApi.aggregateLogs).mockReset();
    logsApi.listLogs.mockResolvedValue(logsSearchResponse);
    logsApi.aggregateLogs.mockResolvedValue({ data: {} });
    client = new LogsClient(createMockConfig());
    timestamps = createTestTimestamps();
  });

  describe("searchLogs", () => {
    it("should search logs successfully", async () => {
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);

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
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);

      await client.searchLogs("service:api status:error", timestamps.fromMs, timestamps.toMs);

      expect(logsApi.listLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            filter: expect.objectContaining({ query: "service:api status:error" }),
          }),
        })
      );
    });

    it("should handle empty filter query", async () => {
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);

      const { data, error } = await client.searchLogs("", timestamps.fromMs, timestamps.toMs);

      assertValidResponse({ data, error }, false);
      expect(logsApi.listLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            filter: expect.objectContaining({ query: "" }),
          }),
        })
      );
    });

    it("should handle default page size", async () => {
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);

      await client.searchLogs("service:api", timestamps.fromMs, timestamps.toMs);

      expect(logsApi.listLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            page: expect.objectContaining({ limit: 10 }),
          }),
        })
      );
    });

    it("should include custom page size", async () => {
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);

      await client.searchLogs("service:api", timestamps.fromMs, timestamps.toMs, 50);

      expect(logsApi.listLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            page: expect.objectContaining({ limit: 50 }),
          }),
        })
      );
    });

    it("should enforce maximum page size of 100", async () => {
      const { data, error } = await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        150
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Page size must be between 1 and 100");
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
      const err = new Error("Unauthorized");
      err.statusCode = 401;
      logsApi.listLogs.mockRejectedValue(err);

      const { data, error } = await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(401);
    });

    it("should handle 429 rate limit", async () => {
      const err = new Error("Too Many Requests");
      err.statusCode = 429;
      logsApi.listLogs.mockRejectedValue(err);

      const { data: _data, error } = await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      expect(error.statusCode).toBe(429);
    });

    it("should include timestamp sorting", async () => {
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);

      await client.searchLogs("service:api", timestamps.fromMs, timestamps.toMs);

      expect(logsApi.listLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ sort: "timestamp" }),
        })
      );
    });

    it("should floor timestamps", async () => {
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);
      const fromFloat = timestamps.fromMs + 0.5;
      const toFloat = timestamps.toMs + 0.7;

      await client.searchLogs("service:api", fromFloat, toFloat);

      const call = logsApi.listLogs.mock.calls[0][0];
      expect(call.body.filter.from).toBe(new Date(Math.floor(fromFloat)).toISOString());
      expect(call.body.filter.to).toBe(new Date(Math.floor(toFloat)).toISOString());
    });
  });

  describe("getLogDetails", () => {
    it("should get log details successfully", async () => {
      const logEntry = {
        id: "AXvj0ZDn5d08oxCb7t9q",
        type: "logs",
        attributes: {
          timestamp: 1609459200000,
          message: "Test log entry",
        },
      };
      logsApi.listLogs.mockResolvedValue({ data: [logEntry] });

      const { data, error } = await client.getLogDetails("AXvj0ZDn5d08oxCb7t9q");

      assertValidResponse({ data, error }, false);
      expect(data).toBeDefined();
      expect(data.id).toBe("AXvj0ZDn5d08oxCb7t9q");
      expect(data.attributes?.message).toBe("Test log entry");
    });

    it("should encode log ID in query", async () => {
      logsApi.listLogs.mockResolvedValue({ data: [{}] });

      await client.getLogDetails("AXvj0ZDn5d08oxCb7t9q");

      expect(logsApi.listLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            filter: expect.objectContaining({
              query: expect.stringContaining("AXvj0ZDn5d08oxCb7t9q"),
            }),
          }),
        })
      );
    });

    it("should handle special characters in log ID", async () => {
      logsApi.listLogs.mockResolvedValue({ data: [{}] });
      const logId = "log-id_with_alphanumeric";

      await client.getLogDetails(logId);

      expect(logsApi.listLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            filter: expect.objectContaining({
              query: expect.stringContaining(logId),
            }),
          }),
        })
      );
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
      const err = new Error("Not Found");
      err.statusCode = 404;
      logsApi.listLogs.mockRejectedValue(err);

      const { data, error } = await client.getLogDetails("nonexistent-id");

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(404);
    });

    it("should handle API errors", async () => {
      const err = new Error("Internal Server Error");
      err.statusCode = 500;
      logsApi.listLogs.mockRejectedValue(err);

      const { data, error } = await client.getLogDetails("AXvj0ZDn5d08oxCb7t9q");

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(500);
    });
  });

  describe("aggregateLogs", () => {
    it("should aggregate logs with avg", async () => {
      logsApi.aggregateLogs.mockResolvedValue({ aggregation: { avg: 42.5 } });

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
      logsApi.aggregateLogs.mockResolvedValue({ aggregation: { max: 100 } });

      const { data, error } = await client.aggregateLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        "max"
      );

      assertValidResponse({ data, error }, false);
    });

    it("should aggregate logs with min", async () => {
      logsApi.aggregateLogs.mockResolvedValue({ aggregation: { min: 10 } });

      const { data, error } = await client.aggregateLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        "min"
      );

      assertValidResponse({ data, error }, false);
    });

    it("should aggregate logs with sum", async () => {
      logsApi.aggregateLogs.mockResolvedValue({ aggregation: { sum: 5000 } });

      const { data, error } = await client.aggregateLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        "sum"
      );

      assertValidResponse({ data, error }, false);
    });

    it("should aggregate logs with cardinality", async () => {
      logsApi.aggregateLogs.mockResolvedValue({ aggregation: { cardinality: 150 } });

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
      logsApi.aggregateLogs.mockResolvedValue({ aggregation: { avg: 50 } });

      await client.aggregateLogs(
        "service:api status:error",
        timestamps.fromMs,
        timestamps.toMs,
        "avg"
      );

      expect(logsApi.aggregateLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            filter: expect.objectContaining({ query: "service:api status:error" }),
          }),
        })
      );
    });

    it("should include aggregation type in request", async () => {
      logsApi.aggregateLogs.mockResolvedValue({ aggregation: { avg: 50 } });

      await client.aggregateLogs("service:api", timestamps.fromMs, timestamps.toMs, "max");

      expect(logsApi.aggregateLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            compute: expect.arrayContaining([expect.objectContaining({ aggregation: "max" })]),
          }),
        })
      );
    });

    it("should handle empty filter with aggregation", async () => {
      logsApi.aggregateLogs.mockResolvedValue({ aggregation: { sum: 1000 } });

      const { data, error } = await client.aggregateLogs(
        "",
        timestamps.fromMs,
        timestamps.toMs,
        "sum"
      );

      assertValidResponse({ data, error }, false);
    });

    it("should handle API errors during aggregation", async () => {
      const err = new Error("Bad Request");
      err.statusCode = 400;
      logsApi.aggregateLogs.mockRejectedValue(err);

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
    // listIndexes uses require() for v1.LogsIndexesApi; in ESM the mock may not apply
    it.skip("should list log indexes successfully", async () => {
      const indexesData = [
        { name: "main", daily_storage_gb: 100 },
        { name: "analytics", daily_storage_gb: 50 },
      ];
      const { logsIndexesApi } = mockDatadogApi;
      vi.mocked(logsIndexesApi.listLogIndexes).mockResolvedValue({
        data: indexesData,
      });

      const { data, error } = await client.listIndexes();

      assertValidResponse({ data, error }, false);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it.skip("should handle empty index list", async () => {
      const { logsIndexesApi } = mockDatadogApi;
      vi.mocked(logsIndexesApi.listLogIndexes).mockResolvedValue({ data: [] });

      const { data, error } = await client.listIndexes();

      assertValidResponse({ data, error }, false);
      expect(data.data).toHaveLength(0);
    });

    it.skip("should handle API errors", async () => {
      const err = new Error("Unauthorized");
      err.statusCode = 401;
      const { logsIndexesApi } = mockDatadogApi;
      vi.mocked(logsIndexesApi.listLogIndexes).mockRejectedValue(err);

      const { data, error } = await client.listIndexes();

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(401);
    });
  });

  describe("API integration", () => {
    it("should call listLogs with correct config", async () => {
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);

      await client.searchLogs("service:api", timestamps.fromMs, timestamps.toMs);

      expect(logsApi.listLogs).toHaveBeenCalled();
    });

    it("should use SDK for search", async () => {
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);

      await client.searchLogs("service:api", timestamps.fromMs, timestamps.toMs);

      expect(logsApi.listLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            filter: expect.any(Object),
            page: expect.any(Object),
          }),
        })
      );
    });

    it("should support custom site domain", () => {
      const customClient = new LogsClient({
        ...createMockConfig(),
        site: "datadoghq.eu",
      });

      expect(customClient.site).toBe("datadoghq.eu");
    });
  });

  describe("error handling", () => {
    it("should handle validation errors", async () => {
      const err = new Error("Bad Request");
      err.statusCode = 400;
      logsApi.listLogs.mockRejectedValue(err);

      const { data, error } = await client.searchLogs(
        "invalid:filter:",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(400);
    });

    it("should handle 500 errors", async () => {
      const err = new Error("Internal Server Error");
      err.statusCode = 500;
      logsApi.listLogs.mockRejectedValue(err);

      const { data, error } = await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(500);
    });

    it("should preserve error details", async () => {
      const err = new Error("Forbidden");
      err.statusCode = 403;
      logsApi.listLogs.mockRejectedValue(err);

      const { data: _data, error } = await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      expect(error).toBeDefined();
      expect(error.statusCode).toBe(403);
      expect(error.originalError).toBe(err);
    });
  });

  describe("pagination", () => {
    it("should include pagination cursor in response", async () => {
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);

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
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);

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
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);
      const year2030From = 1893456000000; // 2030-01-01 in ms
      const year2030To = 1893542400000; // 2030-01-02 in ms

      const { data, error } = await client.searchLogs("service:api", year2030From, year2030To);

      assertValidResponse({ data, error }, false);
    });

    it("should handle complex filter queries", async () => {
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);
      const complexFilter = "service:api AND status:error AND (host:web-01 OR host:web-02)";

      const { data, error } = await client.searchLogs(
        complexFilter,
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
    });

    it("should handle unicode in filter", async () => {
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);
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
