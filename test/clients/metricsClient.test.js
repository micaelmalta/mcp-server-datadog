/**
 * Tests for Datadog Metrics API client.
 */

import "#test/mocks/datadogApi.js";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MetricsClient } from "#clients/metricsClient.js";
import { DatadogClientError } from "#utils/errors.js";
import { mockDatadogApi } from "#test/mocks/datadogApi.js";
import {
  createMockConfig,
  createTestTimestamps,
  assertValidResponse,
} from "#test/helpers.js";
import {
  metricsQueryResponse,
  metricMetadataResponse,
} from "#test/fixtures/datadogResponses.js";

describe("MetricsClient", () => {
  let client;
  let timestamps;
  const { metricsApi } = mockDatadogApi;

  beforeEach(() => {
    vi.mocked(metricsApi.queryMetrics).mockReset();
    vi.mocked(metricsApi.getMetricMetadata).mockReset();
    vi.mocked(metricsApi.listMetrics).mockReset();
    client = new MetricsClient(createMockConfig());
    timestamps = createTestTimestamps();
  });

  describe("queryMetrics", () => {
    it("should query metrics successfully", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);

      const { data, error } = await client.queryMetrics(
        "avg:system.cpu{*}",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
      expect(data.status).toBe("ok");
      expect(data.series).toBeDefined();
      expect(Array.isArray(data.series)).toBe(true);
    });

    it("should include metric query in request", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);

      await client.queryMetrics("avg:system.cpu{*}", timestamps.from, timestamps.to);

      expect(metricsApi.queryMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          query: "avg:system.cpu{*}",
        })
      );
    });

    it("should convert Unix timestamps correctly", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);

      await client.queryMetrics("avg:system.cpu{*}", timestamps.from, timestamps.to);

      expect(metricsApi.queryMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          from: timestamps.from,
          to: timestamps.to,
        })
      );
    });

    it("should handle empty query error", async () => {
      const { data, error } = await client.queryMetrics(
        "",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Query parameter is required");
    });

    it("should handle null query error", async () => {
      const { data, error } = await client.queryMetrics(
        null,
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Query parameter is required");
    });

    it("should reject when from >= to", async () => {
      const { data, error } = await client.queryMetrics(
        "avg:system.cpu{*}",
        timestamps.to,
        timestamps.from
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Start time must be before end time");
    });

    it("should reject when from equals to", async () => {
      const { data, error } = await client.queryMetrics(
        "avg:system.cpu{*}",
        timestamps.from,
        timestamps.from
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Start time must be before end time");
    });

    it("should handle API errors", async () => {
      const err = Object.assign(new Error("Unauthorized"), { statusCode: 401 });
      metricsApi.queryMetrics.mockRejectedValue(err);

      const { data, error } = await client.queryMetrics(
        "avg:system.cpu{*}",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, true);
      expect(error).toBeInstanceOf(DatadogClientError);
      expect(error.statusCode).toBe(401);
    });

    it("should handle rate limit errors", async () => {
      const err = Object.assign(new Error("Too Many Requests"), { statusCode: 429 });
      metricsApi.queryMetrics.mockRejectedValue(err);

      const { data, error } = await client.queryMetrics(
        "avg:system.cpu{*}",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(429);
    });

    it("should handle 500 server errors", async () => {
      const err = Object.assign(new Error("Internal Server Error"), { statusCode: 500 });
      metricsApi.queryMetrics.mockRejectedValue(err);

      const { data, error } = await client.queryMetrics(
        "avg:system.cpu{*}",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(500);
    });

    it("should preserve query with special characters", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
      const query = "avg:system.cpu{env:prod,service:api}";

      await client.queryMetrics(query, timestamps.from, timestamps.to);

      expect(metricsApi.queryMetrics).toHaveBeenCalledWith(
        expect.objectContaining({ query })
      );
    });

    it("should handle responses with multiple series", async () => {
      const multiSeriesResponse = {
        ...metricsQueryResponse,
        series: [
          ...metricsQueryResponse.series,
          {
            ...metricsQueryResponse.series[0],
            scope: "host:web-02",
          },
        ],
      };
      metricsApi.queryMetrics.mockResolvedValue(multiSeriesResponse);

      const { data } = await client.queryMetrics(
        "avg:system.cpu{*}",
        timestamps.from,
        timestamps.to
      );

      expect(data.series).toHaveLength(2);
    });

    it("should handle empty series response", async () => {
      metricsApi.queryMetrics.mockResolvedValue({ ...metricsQueryResponse, series: [] });

      const { data, error } = await client.queryMetrics(
        "avg:system.cpu{*}",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
      expect(data.series).toHaveLength(0);
    });
  });

  describe("getMetricMetadata", () => {
    it("should get metric metadata successfully", async () => {
      metricsApi.getMetricMetadata.mockResolvedValue(metricMetadataResponse);

      const { data, error } = await client.getMetricMetadata("system.cpu");

      assertValidResponse({ data, error }, false);
      expect(data.type).toBe("gauge");
      expect(data.unit).toBe("percent");
    });

    it("should encode metric name in URL", async () => {
      metricsApi.getMetricMetadata.mockResolvedValue(metricMetadataResponse);

      await client.getMetricMetadata("system.cpu");

      expect(metricsApi.getMetricMetadata).toHaveBeenCalledWith({
        metricName: "system.cpu",
      });
    });

    it("should handle special characters in metric name", async () => {
      metricsApi.getMetricMetadata.mockResolvedValue(metricMetadataResponse);
      const metricName = "system.cpu.user";

      await client.getMetricMetadata(metricName);

      expect(metricsApi.getMetricMetadata).toHaveBeenCalledWith({
        metricName,
      });
    });

    it("should handle empty metric name error", async () => {
      const { data, error } = await client.getMetricMetadata("");

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Metric name is required");
    });

    it("should handle null metric name error", async () => {
      const { data, error } = await client.getMetricMetadata(null);

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Metric name is required");
    });

    it("should handle 404 not found errors", async () => {
      const err = Object.assign(new Error("Not Found"), { statusCode: 404 });
      metricsApi.getMetricMetadata.mockRejectedValue(err);

      const { data, error } = await client.getMetricMetadata("nonexistent.metric");

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(404);
    });

    it("should handle 403 forbidden errors", async () => {
      const err = Object.assign(new Error("Forbidden"), { statusCode: 403 });
      metricsApi.getMetricMetadata.mockRejectedValue(err);

      const { data, error } = await client.getMetricMetadata("system.cpu");

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(403);
    });

    it("should preserve metadata in response", async () => {
      const responseWithMetadata = {
        ...metricMetadataResponse,
        metadata: {
          origin: "check_run",
          unit: "percent",
          custom_field: "test",
        },
      };
      metricsApi.getMetricMetadata.mockResolvedValue(responseWithMetadata);

      const { data } = await client.getMetricMetadata("system.cpu");

      expect(data.metadata).toEqual(responseWithMetadata.metadata);
    });
  });

  describe("listMetrics", () => {
    it("should list all metrics without query", async () => {
      metricsApi.listMetrics.mockResolvedValue({
        results: ["system.cpu", "system.memory", "system.disk"],
      });

      const { data, error } = await client.listMetrics();

      assertValidResponse({ data, error }, false);
      expect(data.results).toBeDefined();
    });

    it("should list metrics with search query", async () => {
      metricsApi.listMetrics.mockResolvedValue({
        results: ["system.cpu.user", "system.cpu.system"],
      });

      const { data, error } = await client.listMetrics("system.cpu");

      assertValidResponse({ data, error }, false);
      expect(data.results).toBeDefined();
    });

    it("should include query in request when provided", async () => {
      metricsApi.listMetrics.mockResolvedValue({ results: [] });

      await client.listMetrics("cpu");

      expect(metricsApi.listMetrics).toHaveBeenCalledWith(
        expect.objectContaining({ q: "cpu" })
      );
    });

    it("should not include query parameter when empty", async () => {
      metricsApi.listMetrics.mockResolvedValue({ results: [] });

      await client.listMetrics("");

      expect(metricsApi.listMetrics).toHaveBeenCalledWith(
        expect.objectContaining({ q: "*" })
      );
    });

    it("should handle empty results", async () => {
      metricsApi.listMetrics.mockResolvedValue({ results: [] });

      const { data, error } = await client.listMetrics("nonexistent");

      assertValidResponse({ data, error }, false);
      expect(data.results).toHaveLength(0);
    });

    it("should handle large result sets", async () => {
      const metrics = Array.from({ length: 100 }, (_, i) => `metric.${i}`);
      metricsApi.listMetrics.mockResolvedValue({ results: metrics });

      const { data, error } = await client.listMetrics();

      assertValidResponse({ data, error }, false);
      expect(data.results).toHaveLength(100);
    });

    it("should handle API errors during list", async () => {
      const err = Object.assign(new Error("Unauthorized"), { statusCode: 401 });
      metricsApi.listMetrics.mockRejectedValue(err);

      const { data, error } = await client.listMetrics();

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(401);
    });
  });

  describe("validateQuery", () => {
    it("should validate valid query", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);

      const { data, error } = await client.validateQuery("avg:system.cpu{*}");

      assertValidResponse({ data, error }, false);
      expect(data.valid).toBe(true);
    });

    it("should reject empty query", async () => {
      const { data, error } = await client.validateQuery("");

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Query parameter is required");
    });

    it("should reject null query", async () => {
      const { data, error } = await client.validateQuery(null);

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Query parameter is required");
    });

    it("should detect invalid syntax in query response", async () => {
      const err = Object.assign(new Error("Bad Request"), { statusCode: 400 });
      metricsApi.queryMetrics.mockRejectedValue(err);

      const { data, error } = await client.validateQuery("invalid:::query");

      assertValidResponse({ data, error }, true);
      expect(error).toBeDefined();
    });

    it("should handle validation API errors", async () => {
      const err = Object.assign(new Error("Bad Request"), { statusCode: 400 });
      metricsApi.queryMetrics.mockRejectedValue(err);

      const { data, error } = await client.validateQuery("avg:system.cpu{*}");

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(400);
    });
  });

  describe("API integration", () => {
    it("should store config (apiKey, appKey)", () => {
      const config = createMockConfig();
      expect(client.apiKey).toBe(config.apiKey);
      expect(client.appKey).toBe(config.appKey);
    });

    it("should support custom site domain", () => {
      const customClient = new MetricsClient({
        ...createMockConfig(),
        site: "datadoghq.eu",
      });

      expect(customClient.site).toBe("datadoghq.eu");
    });

    it("should propagate network errors", async () => {
      const err = Object.assign(new Error("Internal Server Error"), {
        statusCode: 500,
      });
      metricsApi.queryMetrics.mockRejectedValue(err);

      const { data, error } = await client.queryMetrics(
        "avg:system.cpu{*}",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, true);
      expect(error).toBeInstanceOf(DatadogClientError);
    });
  });

  describe("timestamp handling", () => {
    it("should floor Unix timestamps", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
      const fromFloat = timestamps.from + 0.5;
      const toFloat = timestamps.to + 0.7;

      await client.queryMetrics("avg:system.cpu{*}", fromFloat, toFloat);

      expect(metricsApi.queryMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          from: Math.floor(fromFloat),
          to: Math.floor(toFloat),
        })
      );
    });

    it("should accept large timestamp values", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
      const year2030From = 1893456000;
      const year2030To = 1893542400;

      const { data, error } = await client.queryMetrics(
        "avg:system.cpu{*}",
        year2030From,
        year2030To
      );

      assertValidResponse({ data, error }, false);
    });
  });

  describe("error scenarios", () => {
    it("should handle 401 unauthorized", async () => {
      const err = Object.assign(new Error("Unauthorized"), { statusCode: 401 });
      metricsApi.queryMetrics.mockRejectedValue(err);

      const { data, error } = await client.queryMetrics(
        "avg:system.cpu{*}",
        timestamps.from,
        timestamps.to
      );

      expect(error.statusCode).toBe(401);
      expect(error.message).toContain("401");
    });

    it("should handle 403 forbidden", async () => {
      const err = Object.assign(new Error("Forbidden"), { statusCode: 403 });
      metricsApi.queryMetrics.mockRejectedValue(err);

      const { data, error } = await client.queryMetrics(
        "avg:system.cpu{*}",
        timestamps.from,
        timestamps.to
      );

      expect(error.statusCode).toBe(403);
    });

    it("should preserve error details in originalError", async () => {
      const rawError = Object.assign(new Error("Bad Request"), { statusCode: 400 });
      metricsApi.queryMetrics.mockRejectedValue(rawError);

      const { data, error } = await client.queryMetrics(
        "invalid query",
        timestamps.from,
        timestamps.to
      );

      expect(error.originalError).toBe(rawError);
    });
  });
});
