/**
 * Tests for Datadog Metrics MCP tools.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MetricsClient } from "#clients/metricsClient.js";
import { getMetricsTools } from "#tools/metricsTools.js";
import { mockDatadogApi } from "#test/mocks/datadogApi.js";
import {
  createMockConfig,
  createTestTimestamps,
} from "#test/helpers.js";
import { metricsQueryResponse, metricMetadataResponse } from "#test/fixtures/datadogResponses.js";

describe("Metrics Tools", () => {
  let tools;
  let client;
  let timestamps;
  const { metricsApi } = mockDatadogApi;

  beforeEach(() => {
    vi.mocked(metricsApi.queryMetrics).mockReset();
    vi.mocked(metricsApi.getMetricMetadata).mockReset();
    vi.mocked(metricsApi.listMetrics).mockReset();
    timestamps = createTestTimestamps();
    metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
    metricsApi.getMetricMetadata.mockResolvedValue(metricMetadataResponse);
    metricsApi.listMetrics.mockResolvedValue({ results: [] });
    client = new MetricsClient(createMockConfig());
    tools = getMetricsTools(client);
  });

  describe("query_metrics tool", () => {
    it("should have query_metrics tool", () => {
      const queryTool = tools.find((t) => t.name === "query_metrics");
      expect(queryTool).toBeDefined();
      expect(queryTool.description).toBeDefined();
      expect(queryTool.inputSchema).toBeDefined();
    });

    it("should have correct input schema", () => {
      const queryTool = tools.find((t) => t.name === "query_metrics");
      const schema = queryTool.inputSchema;

      expect(schema.required).toContain("metricName");
      expect(schema.required).toContain("from");
      expect(schema.required).toContain("to");
      expect(schema.properties.metricName).toBeDefined();
      expect(schema.properties.from).toBeDefined();
      expect(schema.properties.to).toBeDefined();
      expect(schema.properties.filter).toBeDefined();
    });

    it("should query metrics with numeric timestamps", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
      const queryTool = tools.find((t) => t.name === "query_metrics");

      const result = await queryTool.handler({
        metricName: "system.cpu",
        from: timestamps.from,
        to: timestamps.to,
      });

      expect(result.isError).toBe(false);
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");
    });

    it("should query metrics with ISO 8601 timestamps", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
      const queryTool = tools.find((t) => t.name === "query_metrics");

      const result = await queryTool.handler({
        metricName: "system.cpu",
        from: timestamps.fromIso,
        to: timestamps.toIso,
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].type).toBe("text");
    });

    it("should include metric name in result", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
      const queryTool = tools.find((t) => t.name === "query_metrics");

      const result = await queryTool.handler({
        metricName: "system.cpu",
        from: timestamps.from,
        to: timestamps.to,
      });

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text);
      expect(content.metric).toBe("system.cpu");
    });

    it("should include optional filter in query", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
      const queryTool = tools.find((t) => t.name === "query_metrics");

      const result = await queryTool.handler({
        metricName: "system.cpu",
        from: timestamps.from,
        to: timestamps.to,
        filter: "host:web-01",
      });

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text);
      expect(content.filter).toBe("host:web-01");
    });

    it("should reject filter containing { or } (security)", async () => {
      const queryTool = tools.find((t) => t.name === "query_metrics");

      const resultWithBrace = await queryTool.handler({
        metricName: "system.cpu",
        from: timestamps.from,
        to: timestamps.to,
        filter: "env:prod}",
      });
      expect(resultWithBrace.isError).toBe(true);
      expect(resultWithBrace.content[0].text).toMatch(/\{ or \}/);

      const resultWithOpen = await queryTool.handler({
        metricName: "system.cpu",
        from: timestamps.from,
        to: timestamps.to,
        filter: "env:prod{",
      });
      expect(resultWithOpen.isError).toBe(true);
    });

    it("should reject when from >= to", async () => {
      const queryTool = tools.find((t) => t.name === "query_metrics");

      const result = await queryTool.handler({
        metricName: "system.cpu",
        from: timestamps.to,
        to: timestamps.from,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/start time.*before.*end time/i);
    });

    it("should reject missing metric name", async () => {
      const queryTool = tools.find((t) => t.name === "query_metrics");

      const result = await queryTool.handler({
        metricName: "",
        from: timestamps.from,
        to: timestamps.to,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("metricName must be a non-empty string");
    });

    it("should handle client errors", async () => {
      metricsApi.queryMetrics.mockRejectedValue(Object.assign(new Error("Unauthorized"), { statusCode: 401 }));
      const queryTool = tools.find((t) => t.name === "query_metrics");

      const result = await queryTool.handler({
        metricName: "system.cpu",
        from: timestamps.from,
        to: timestamps.to,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error querying metrics");
    });

    it("should format response with time range", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
      const queryTool = tools.find((t) => t.name === "query_metrics");

      const result = await queryTool.handler({
        metricName: "system.cpu",
        from: timestamps.from,
        to: timestamps.to,
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.timeRange).toBeDefined();
      expect(content.timeRange.from).toBeDefined();
      expect(content.timeRange.to).toBeDefined();
    });
  });

  describe("get_metric_metadata tool", () => {
    it("should have get_metric_metadata tool", () => {
      const metaTool = tools.find((t) => t.name === "get_metric_metadata");
      expect(metaTool).toBeDefined();
      expect(metaTool.inputSchema).toBeDefined();
    });

    it("should get metric metadata successfully", async () => {
      metricsApi.getMetricMetadata.mockResolvedValue(metricMetadataResponse);
      const metaTool = tools.find((t) => t.name === "get_metric_metadata");

      const result = await metaTool.handler({
        metricName: "system.cpu",
      });

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text);
      expect(content.metric).toBe("system.cpu");
      expect(content.metadata).toBeDefined();
    });

    it("should reject empty metric name", async () => {
      const metaTool = tools.find((t) => t.name === "get_metric_metadata");

      const result = await metaTool.handler({
        metricName: "",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("metricName must be a non-empty string");
    });

    it("should reject null metric name", async () => {
      const metaTool = tools.find((t) => t.name === "get_metric_metadata");

      const result = await metaTool.handler({
        metricName: null,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("metricName must be a non-empty string");
    });

    it("should handle client errors", async () => {
      metricsApi.getMetricMetadata.mockRejectedValue(Object.assign(new Error("Not found"), { statusCode: 404 }));
      const metaTool = tools.find((t) => t.name === "get_metric_metadata");

      const result = await metaTool.handler({
        metricName: "nonexistent",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error retrieving metric metadata");
    });

    it("should preserve metadata fields", async () => {
      metricsApi.getMetricMetadata.mockResolvedValue(metricMetadataResponse);
      const metaTool = tools.find((t) => t.name === "get_metric_metadata");

      const result = await metaTool.handler({
        metricName: "system.cpu",
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.metadata.type).toBe("gauge");
      expect(content.metadata.unit).toBe("percent");
    });
  });

  describe("list_metrics tool", () => {
    it("should have list_metrics tool", () => {
      const listTool = tools.find((t) => t.name === "list_metrics");
      expect(listTool).toBeDefined();
      expect(listTool.inputSchema).toBeDefined();
    });

    it("should list all metrics", async () => {
      metricsApi.listMetrics.mockResolvedValue({
        results: ["system.cpu", "system.memory"],
      });
      const listTool = tools.find((t) => t.name === "list_metrics");

      const result = await listTool.handler({});

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text);
      expect(content.query).toBe("all");
      expect(content.metrics).toBeDefined();
    });

    it("should list metrics with query filter", async () => {
      metricsApi.listMetrics.mockResolvedValue({
        results: ["system.cpu.user", "system.cpu.system"],
      });
      const listTool = tools.find((t) => t.name === "list_metrics");

      const result = await listTool.handler({
        query: "system.cpu",
      });

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text);
      expect(content.query).toBe("system.cpu");
    });

    it("should apply limit to results", async () => {
      const manyMetrics = Array.from({ length: 200 }, (_, i) => `metric.${i}`);
      metricsApi.listMetrics.mockResolvedValue({ results: manyMetrics });
      const listTool = tools.find((t) => t.name === "list_metrics");

      const result = await listTool.handler({
        limit: 50,
      });

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text);
      expect(content.returned).toBe(50);
      expect(content.total).toBe(200);
    });

    it("should enforce maximum limit of 1000", async () => {
      const manyMetrics = Array.from({ length: 1500 }, (_, i) => `metric.${i}`);
      metricsApi.listMetrics.mockResolvedValue({ results: manyMetrics });
      const listTool = tools.find((t) => t.name === "list_metrics");

      const result = await listTool.handler({
        limit: 2000,
      });

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text);
      expect(content.returned).toBe(1000);
    });

    it("should handle empty results", async () => {
      metricsApi.listMetrics.mockResolvedValue({ results: [] });
      const listTool = tools.find((t) => t.name === "list_metrics");

      const result = await listTool.handler({
        query: "nonexistent",
      });

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text);
      expect(content.returned).toBe(0);
    });

    it("should handle client errors", async () => {
      metricsApi.listMetrics.mockRejectedValue(Object.assign(new Error("Unauthorized"), { statusCode: 401 }));
      const listTool = tools.find((t) => t.name === "list_metrics");

      const result = await listTool.handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error listing metrics");
    });

    it("should return metrics count information", async () => {
      metricsApi.listMetrics.mockResolvedValue({ results: ["metric1", "metric2", "metric3"] });
      const listTool = tools.find((t) => t.name === "list_metrics");

      const result = await listTool.handler({});

      const content = JSON.parse(result.content[0].text);
      expect(content.total).toBe(3);
      expect(content.returned).toBe(3);
    });
  });

  describe("tool definition validation", () => {
    it("should have exactly 3 tools", () => {
      expect(tools).toHaveLength(3);
    });

    it("should have all required properties", () => {
      tools.forEach((tool) => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.handler).toBeDefined();
        expect(typeof tool.handler).toBe("function");
      });
    });

    it("should have valid schema for all tools", () => {
      tools.forEach((tool) => {
        const schema = tool.inputSchema;
        expect(schema.type).toBe("object");
        expect(schema.properties).toBeDefined();
        expect(Array.isArray(schema.required) || schema.required === undefined).toBe(true);
      });
    });

    it("should have different tool names", () => {
      const names = tools.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe("timestamp parsing", () => {
    it("should parse Unix seconds correctly", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
      const queryTool = tools.find((t) => t.name === "query_metrics");

      const result = await queryTool.handler({
        metricName: "system.cpu",
        from: 1609459200,
        to: 1609545600,
      });

      expect(result.isError).toBe(false);
    });

    it("should parse ISO 8601 strings correctly", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
      const queryTool = tools.find((t) => t.name === "query_metrics");

      const result = await queryTool.handler({
        metricName: "system.cpu",
        from: "2021-01-01T00:00:00Z",
        to: "2021-01-02T00:00:00Z",
      });

      expect(result.isError).toBe(false);
    });

    it("should handle mixed timestamp formats", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
      const queryTool = tools.find((t) => t.name === "query_metrics");

      const result = await queryTool.handler({
        metricName: "system.cpu",
        from: 1609459200,
        to: "2021-01-02T00:00:00Z",
      });

      expect(result.isError).toBe(false);
    });

    it("should reject invalid timestamp format", async () => {
      const queryTool = tools.find((t) => t.name === "query_metrics");

      const result = await queryTool.handler({
        metricName: "system.cpu",
        from: "invalid-date",
        to: timestamps.to,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error");
    });
  });

  describe("error handling", () => {
    it("should handle exceptions in handlers", async () => {
      metricsApi.queryMetrics.mockRejectedValue(Object.assign(new Error("Unauthorized"), { statusCode: 401 }));
      const queryTool = tools.find((t) => t.name === "query_metrics");

      const result = await queryTool.handler({
        metricName: "system.cpu",
        from: "invalid",
        to: "also invalid",
      });

      expect(result.isError).toBe(true);
    });

    it("should format error responses correctly", async () => {
      const queryTool = tools.find((t) => t.name === "query_metrics");

      const result = await queryTool.handler({
        metricName: "system.cpu",
        from: timestamps.to,
        to: timestamps.from,
      });

      expect(result.isError).toBe(true);
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0].type).toBe("text");
    });

    it("should format success responses correctly", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
      const queryTool = tools.find((t) => t.name === "query_metrics");

      const result = await queryTool.handler({
        metricName: "system.cpu",
        from: timestamps.from,
        to: timestamps.to,
      });

      expect(result.isError).toBe(false);
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBeDefined();
    });
  });
});
