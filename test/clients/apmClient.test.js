/**
 * Tests for Datadog APM/Traces API client.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApmClient } from "#clients/apmClient.js";
import { mockDatadogApi } from "#test/mocks/datadogApi.js";
import { createMockConfig, createTestTimestamps, assertValidResponse } from "#test/helpers.js";
import { tracesQueryResponse } from "#test/fixtures/datadogResponses.js";

describe("ApmClient", () => {
  let client;
  let timestamps;
  const { spansApi, metricsApi } = mockDatadogApi;

  beforeEach(() => {
    vi.mocked(spansApi.listSpansGet).mockReset();
    vi.mocked(metricsApi.queryMetrics).mockReset();
    // Default: spans API returns span list (client builds traces from it)
    spansApi.listSpansGet.mockResolvedValue({ data: tracesQueryResponse.data });
    metricsApi.queryMetrics.mockResolvedValue({
      series: [{ scope: "service:api", tag_set: ["env:prod"], pointlist: [[1, 1]] }],
    });
    client = new ApmClient(createMockConfig());
    timestamps = createTestTimestamps();
  });

  describe("queryTraces", () => {
    it("should query traces successfully when serviceName provided", async () => {
      spansApi.listSpansGet.mockResolvedValue({ data: tracesQueryResponse.data });

      const { data, error } = await client.queryTraces(
        "env:prod",
        timestamps.fromMs,
        timestamps.toMs,
        { serviceName: "api" }
      );

      assertValidResponse({ data, error }, false);
      expect(data.traces).toBeDefined();
      expect(Array.isArray(data.traces)).toBe(true);
      expect(data.tracesCount).toBeDefined();
    });

    it("should call listSpansGet with filter and service when provided", async () => {
      spansApi.listSpansGet.mockResolvedValue({ data: tracesQueryResponse.data });

      await client.queryTraces("env:prod", timestamps.fromMs, timestamps.toMs, {
        serviceName: "api",
      });

      expect(spansApi.listSpansGet).toHaveBeenCalledWith(
        expect.objectContaining({
          filterQuery: "service:api env:prod",
          filterFrom: new Date(timestamps.fromMs).toISOString(),
          filterTo: new Date(timestamps.toMs).toISOString(),
          pageLimit: 100,
        })
      );
    });

    it("should use fallback metrics when no serviceName and empty filter", async () => {
      metricsApi.queryMetrics.mockResolvedValue({
        series: [{ scope: "env:prod", tag_set: [], pointlist: [[1, 1]] }],
      });

      const { data, error } = await client.queryTraces("", timestamps.fromMs, timestamps.toMs);

      assertValidResponse({ data, error }, false);
      expect(data.traces).toBeDefined();
      expect(data.message).toContain("metrics");
      expect(metricsApi.queryMetrics).toHaveBeenCalled();
    });

    it("should support custom page size", async () => {
      spansApi.listSpansGet.mockResolvedValue({ data: tracesQueryResponse.data });

      await client.queryTraces("env:prod", timestamps.fromMs, timestamps.toMs, {
        serviceName: "api",
        pageSize: 50,
      });

      expect(spansApi.listSpansGet).toHaveBeenCalledWith(
        expect.objectContaining({ pageLimit: 50 })
      );
    });

    it("should enforce maximum page size of 100", async () => {
      spansApi.listSpansGet.mockResolvedValue({ data: tracesQueryResponse.data });

      await client.queryTraces("env:prod", timestamps.fromMs, timestamps.toMs, {
        serviceName: "api",
        pageSize: 200,
      });

      expect(spansApi.listSpansGet).toHaveBeenCalledWith(
        expect.objectContaining({ pageLimit: 100 })
      );
    });

    it("should reject when from >= to", async () => {
      const { data, error } = await client.queryTraces(
        "service:api",
        timestamps.toMs,
        timestamps.fromMs,
        { serviceName: "api" }
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Start time must be before end time");
    });

    it("should reject when from equals to", async () => {
      const { data, error } = await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.fromMs,
        { serviceName: "api" }
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Start time must be before end time");
    });

    it("should handle API errors when spans and fallback both fail", async () => {
      const err = new Error("Unauthorized");
      err.statusCode = 401;
      spansApi.listSpansGet.mockRejectedValue(err);
      metricsApi.queryMetrics.mockRejectedValue(err);

      const { data, error } = await client.queryTraces(
        "env:prod",
        timestamps.fromMs,
        timestamps.toMs,
        { serviceName: "api" }
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(401);
    });

    it("should fall back to metrics when spans API errors", async () => {
      spansApi.listSpansGet.mockRejectedValue(new Error("Forbidden"));
      metricsApi.queryMetrics.mockResolvedValue({
        series: [{ scope: "env:prod", tag_set: [], pointlist: [[1, 1]] }],
      });

      const { data, error } = await client.queryTraces(
        "env:prod",
        timestamps.fromMs,
        timestamps.toMs,
        { serviceName: "api" }
      );

      assertValidResponse({ data, error }, false);
      expect(data.message).toContain("metrics");
    });

    it("should include multiple traces when multiple trace_ids in spans", async () => {
      const twoTraces = [
        { ...tracesQueryResponse.data[0], trace_id: "aaa" },
        { ...tracesQueryResponse.data[1], trace_id: "aaa" },
        { ...tracesQueryResponse.data[0], trace_id: "bbb", span_id: "b1" },
      ];
      spansApi.listSpansGet.mockResolvedValue({ data: twoTraces });

      const { data } = await client.queryTraces("env:prod", timestamps.fromMs, timestamps.toMs, {
        serviceName: "api",
      });

      expect(data.traces.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getServiceHealth", () => {
    it("should get service health successfully", async () => {
      metricsApi.queryMetrics.mockResolvedValue({ series: [] });

      const { data, error } = await client.getServiceHealth(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
      expect(data.service).toBe("api");
      expect(data.requests).toBeDefined();
      expect(data.errors).toBeDefined();
      expect(data.latency).toBeDefined();
    });

    it("should reject empty service name", async () => {
      const { data, error } = await client.getServiceHealth("", timestamps.fromMs, timestamps.toMs);

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Service name is required");
    });

    it("should reject null service name", async () => {
      const { data, error } = await client.getServiceHealth(
        null,
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Service name is required");
    });

    it("should call queryMetrics with service filter", async () => {
      metricsApi.queryMetrics.mockResolvedValue({ series: [] });

      await client.getServiceHealth("api", timestamps.fromMs, timestamps.toMs);

      expect(metricsApi.queryMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          from: Math.floor(timestamps.fromMs / 1000),
          to: Math.floor(timestamps.toMs / 1000),
        })
      );
    });

    it("should reject when from >= to", async () => {
      const { data, error } = await client.getServiceHealth(
        "api",
        timestamps.toMs,
        timestamps.fromMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Start time must be before end time");
    });

    it("should return empty arrays when metrics return no series", async () => {
      metricsApi.queryMetrics.mockResolvedValue({ series: [] });

      const { data, error } = await client.getServiceHealth(
        "nonexistent",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
      expect(data.requests).toHaveLength(0);
      expect(data.errors).toHaveLength(0);
      expect(data.latency).toHaveLength(0);
    });

    it("should return requests, errors, latency arrays", async () => {
      metricsApi.queryMetrics.mockResolvedValue({
        series: [{ scope: "service:api", pointlist: [[1, 1]] }],
      });

      const { data } = await client.getServiceHealth("api", timestamps.fromMs, timestamps.toMs);

      expect(Array.isArray(data.requests)).toBe(true);
      expect(Array.isArray(data.errors)).toBe(true);
      expect(Array.isArray(data.latency)).toBe(true);
    });

    it("should handle services with hyphens in name", async () => {
      metricsApi.queryMetrics.mockResolvedValue({ series: [] });

      const { data, error } = await client.getServiceHealth(
        "api-gateway",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
    });
  });

  describe("getServiceDependencies", () => {
    it("should get service dependencies successfully", async () => {
      metricsApi.queryMetrics.mockResolvedValue({
        series: [{ scope: "service:api", tag_set: ["env:prod"] }],
      });

      const { data, error } = await client.getServiceDependencies(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
      expect(data.service).toBe("api");
      expect(data.dependencies).toBeDefined();
      expect(data.message).toBeDefined();
    });

    it("should reject empty service name", async () => {
      const { data, error } = await client.getServiceDependencies(
        "",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Service name is required");
    });

    it("should reject null service name", async () => {
      const { data, error } = await client.getServiceDependencies(
        null,
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Service name is required");
    });

    it("should include service in queryMetrics", async () => {
      metricsApi.queryMetrics.mockResolvedValue({ series: [] });

      await client.getServiceDependencies("api", timestamps.fromMs, timestamps.toMs);

      expect(metricsApi.queryMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "trace.*{service:api}",
        })
      );
    });

    it("should return dependency list from series", async () => {
      metricsApi.queryMetrics.mockResolvedValue({
        series: [
          { scope: "service:api", tag_set: ["env:prod"] },
          { scope: "service:database", tag_set: [] },
        ],
      });

      const { data } = await client.getServiceDependencies(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      expect(Array.isArray(data.dependencies)).toBe(true);
      expect(data.dependencies.length).toBe(2);
    });

    it("should handle API errors", async () => {
      const err = new Error("Forbidden");
      err.statusCode = 403;
      metricsApi.queryMetrics.mockRejectedValue(err);

      const { data, error } = await client.getServiceDependencies(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(403);
    });
  });

  describe("listServices", () => {
    it("should list services successfully", async () => {
      metricsApi.queryMetrics.mockResolvedValue({
        series: [
          { scope: "service:api,env:prod" },
          { scope: "service:database,env:prod" },
          { scope: "service:cache" },
        ],
      });

      const { data, error } = await client.listServices();

      assertValidResponse({ data, error }, false);
      expect(Array.isArray(data)).toBe(true);
      expect(data.some((s) => s.service === "api")).toBe(true);
      expect(data.some((s) => s.service === "database")).toBe(true);
    });

    it("should handle empty service list", async () => {
      metricsApi.queryMetrics.mockResolvedValue({ series: [] });

      const { data, error } = await client.listServices();

      assertValidResponse({ data, error }, false);
      expect(data).toHaveLength(0);
    });

    it("should handle API errors", async () => {
      const err = new Error("Unauthorized");
      err.statusCode = 401;
      metricsApi.queryMetrics.mockRejectedValue(err);

      const { data, error } = await client.listServices();

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(401);
    });
  });

  describe("listServiceEndpoints", () => {
    it("should list endpoints successfully", async () => {
      spansApi.listSpansGet.mockResolvedValue({
        data: [
          { attributes: { service: "api", resourceName: "GET /health" } },
          { attributes: { service: "api", resourceName: "POST /users" } },
        ],
      });

      const { data, error } = await client.listServiceEndpoints(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
      expect(data.endpoints).toBeDefined();
      expect(Array.isArray(data.endpoints)).toBe(true);
    });

    it("should reject when service name missing", async () => {
      const { data, error } = await client.listServiceEndpoints(
        "",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Service name and valid time range");
    });

    it("should reject when from >= to", async () => {
      const { data, error } = await client.listServiceEndpoints(
        "api",
        timestamps.toMs,
        timestamps.fromMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Service name and valid time range");
    });
  });

  describe("API integration", () => {
    it("should use spansApi when querying traces with serviceName", async () => {
      spansApi.listSpansGet.mockResolvedValue({ data: tracesQueryResponse.data });

      await client.queryTraces("env:prod", timestamps.fromMs, timestamps.toMs, {
        serviceName: "api",
      });

      expect(spansApi.listSpansGet).toHaveBeenCalledTimes(1);
    });

    it("should support custom site domain", () => {
      const customClient = new ApmClient({
        ...createMockConfig(),
        site: "datadoghq.eu",
      });

      expect(customClient.site).toBe("datadoghq.eu");
    });
  });

  describe("error handling", () => {
    it("should handle 401 unauthorized", async () => {
      const err = new Error("Unauthorized");
      err.statusCode = 401;
      spansApi.listSpansGet.mockRejectedValue(err);
      metricsApi.queryMetrics.mockRejectedValue(err);

      const { data: _data, error } = await client.queryTraces(
        "env:prod",
        timestamps.fromMs,
        timestamps.toMs,
        { serviceName: "api" }
      );

      expect(error.statusCode).toBe(401);
    });

    it("should handle 403 forbidden", async () => {
      const err = new Error("Forbidden");
      err.statusCode = 403;
      metricsApi.queryMetrics.mockRejectedValue(err);

      const { data: _data, error } = await client.getServiceDependencies(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      expect(error.statusCode).toBe(403);
    });

    it("should handle 429 rate limit", async () => {
      const err = new Error("Too Many Requests");
      err.statusCode = 429;
      spansApi.listSpansGet.mockRejectedValue(err);
      metricsApi.queryMetrics.mockRejectedValue(err);

      const { data: _data, error } = await client.queryTraces(
        "env:prod",
        timestamps.fromMs,
        timestamps.toMs,
        { serviceName: "api" }
      );

      expect(error.statusCode).toBe(429);
    });

    it("should handle 500 server error", async () => {
      const err = new Error("Internal Server Error");
      err.statusCode = 500;
      metricsApi.queryMetrics.mockRejectedValue(err);

      const { data: _data, error } = await client.listServices();

      expect(error.statusCode).toBe(500);
    });

    it("should preserve error details", async () => {
      const err = new Error("Bad Request");
      err.statusCode = 400;
      spansApi.listSpansGet.mockRejectedValue(err);
      metricsApi.queryMetrics.mockRejectedValue(err);

      const { data: _data, error } = await client.queryTraces(
        "env:prod",
        timestamps.fromMs,
        timestamps.toMs,
        { serviceName: "api" }
      );

      expect(error.originalError).toBe(err);
    });
  });

  describe("edge cases", () => {
    it("should handle service names with special characters", async () => {
      metricsApi.queryMetrics.mockResolvedValue({ series: [] });

      const { data, error } = await client.getServiceHealth(
        "api-gateway-v2",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
    });

    it("should handle complex filter with serviceName", async () => {
      spansApi.listSpansGet.mockResolvedValue({ data: tracesQueryResponse.data });

      const { data, error } = await client.queryTraces(
        "env:prod status:error",
        timestamps.fromMs,
        timestamps.toMs,
        { serviceName: "api" }
      );

      assertValidResponse({ data, error }, false);
      expect(spansApi.listSpansGet).toHaveBeenCalledWith(
        expect.objectContaining({
          filterQuery: "service:api env:prod status:error",
        })
      );
    });

    it("should handle very large timestamp values", async () => {
      spansApi.listSpansGet.mockResolvedValue({ data: tracesQueryResponse.data });
      const year2030From = 1893456000000;
      const year2030To = 1893542400000;

      const { data, error } = await client.queryTraces("env:prod", year2030From, year2030To, {
        serviceName: "api",
      });

      assertValidResponse({ data, error }, false);
    });
  });
});
