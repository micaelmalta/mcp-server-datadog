/**
 * Tests for Datadog APM MCP tools.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApmClient } from "#clients/apmClient.js";
import { getApmTools } from "#tools/apmTools.js";
import { mockDatadogApi } from "#test/mocks/datadogApi.js";
import { clearMocks, createMockConfig, createTestTimestamps } from "#test/helpers.js";
import { tracesQueryResponse } from "#test/fixtures/datadogResponses.js";

describe("APM Tools", () => {
  let tools;
  let client;
  let timestamps;
  const { spansApi, metricsApi } = mockDatadogApi;

  beforeEach(() => {
    clearMocks();
    timestamps = createTestTimestamps();
    // Spans API returns span list; ApmClient builds traces from spans (trace_id, attributes)
    spansApi.listSpansGet.mockResolvedValue({ data: tracesQueryResponse.data });
    metricsApi.queryMetrics.mockResolvedValue({ series: [] });
    client = new ApmClient(createMockConfig());
    tools = getApmTools(client);
  });

  describe("query_traces tool", () => {
    it("should have query_traces tool", () => {
      const queryTool = tools.find((t) => t.name === "query_traces");
      expect(queryTool).toBeDefined();
    });

    it("should query traces successfully", async () => {
      spansApi.listSpansGet.mockResolvedValue({ data: tracesQueryResponse.data });
      const queryTool = tools.find((t) => t.name === "query_traces");

      const result = await queryTool.handler({
        serviceName: "api",
        filter: "service:api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(false);
    });

    it("should reject when from >= to", async () => {
      const queryTool = tools.find((t) => t.name === "query_traces");

      const result = await queryTool.handler({
        serviceName: "api",
        filter: "service:api",
        from: timestamps.toMs,
        to: timestamps.fromMs,
      });

      expect(result.isError).toBe(true);
    });

    it("should handle empty filter", async () => {
      spansApi.listSpansGet.mockResolvedValue({ data: tracesQueryResponse.data });
      const queryTool = tools.find((t) => t.name === "query_traces");

      const result = await queryTool.handler({
        serviceName: "api",
        filter: "",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(false);
    });

    it("should support custom page size", async () => {
      spansApi.listSpansGet.mockResolvedValue({ data: tracesQueryResponse.data });
      const queryTool = tools.find((t) => t.name === "query_traces");

      const result = await queryTool.handler({
        serviceName: "api",
        filter: "service:api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
        pageSize: 50,
      });

      expect(result.isError).toBe(false);
    });

    it("should support custom sort field", async () => {
      spansApi.listSpansGet.mockResolvedValue({ data: tracesQueryResponse.data });
      const queryTool = tools.find((t) => t.name === "query_traces");

      const result = await queryTool.handler({
        serviceName: "api",
        filter: "service:api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
        sortBy: "duration",
      });

      expect(result.isError).toBe(false);
    });
  });

  describe("get_service_health tool", () => {
    it("should have get_service_health tool", () => {
      const healthTool = tools.find((t) => t.name === "get_service_health");
      expect(healthTool).toBeDefined();
    });

    it("should get service health successfully", async () => {
      metricsApi.queryMetrics.mockResolvedValue({ series: [] });
      const healthTool = tools.find((t) => t.name === "get_service_health");

      const result = await healthTool.handler({
        serviceName: "api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text);
      expect(content.serviceName).toBe("api");
      expect(content.health).toBeDefined();
    });

    it("should reject empty service name", async () => {
      const healthTool = tools.find((t) => t.name === "get_service_health");

      const result = await healthTool.handler({
        serviceName: "",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(true);
    });

    it("should reject null service name", async () => {
      const healthTool = tools.find((t) => t.name === "get_service_health");

      const result = await healthTool.handler({
        serviceName: null,
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(true);
    });

    it("should reject when from >= to", async () => {
      const healthTool = tools.find((t) => t.name === "get_service_health");

      const result = await healthTool.handler({
        serviceName: "api",
        from: timestamps.toMs,
        to: timestamps.fromMs,
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("get_service_dependencies tool", () => {
    it("should have get_service_dependencies tool", () => {
      const depsTool = tools.find((t) => t.name === "get_service_dependencies");
      expect(depsTool).toBeDefined();
    });

    it("should get service dependencies successfully", async () => {
      metricsApi.queryMetrics.mockResolvedValue({ series: [] });
      const depsTool = tools.find((t) => t.name === "get_service_dependencies");

      const result = await depsTool.handler({
        serviceName: "api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text);
      expect(content.serviceName).toBe("api");
      expect(content.dependencies).toBeDefined();
    });

    it("should reject empty service name", async () => {
      const depsTool = tools.find((t) => t.name === "get_service_dependencies");

      const result = await depsTool.handler({
        serviceName: "",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(true);
    });

    it("should reject null service name", async () => {
      const depsTool = tools.find((t) => t.name === "get_service_dependencies");

      const result = await depsTool.handler({
        serviceName: null,
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(true);
    });

    it("should reject when from >= to", async () => {
      const depsTool = tools.find((t) => t.name === "get_service_dependencies");

      const result = await depsTool.handler({
        serviceName: "api",
        from: timestamps.toMs,
        to: timestamps.fromMs,
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("tool validation", () => {
    it("should have exactly 3 tools", () => {
      expect(tools).toHaveLength(3);
    });

    it("should have all required properties", () => {
      tools.forEach((tool) => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.handler).toBeDefined();
      });
    });

    it("should have different tool names", () => {
      const names = tools.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe("error handling", () => {
    it("should format errors correctly", async () => {
      const queryTool = tools.find((t) => t.name === "query_traces");

      const result = await queryTool.handler({
        serviceName: "api",
        filter: "service:api",
        from: timestamps.toMs,
        to: timestamps.fromMs,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].type).toBe("text");
    });

    it("should handle client errors", async () => {
      // getServiceHealth catches metric errors and returns empty series; tool still succeeds
      vi.mocked(metricsApi.queryMetrics).mockRejectedValue(new Error("API Error"));
      const healthTool = tools.find((t) => t.name === "get_service_health");

      const result = await healthTool.handler({
        serviceName: "api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text);
      expect(content.serviceName).toBe("api");
      expect(content.health).toBeDefined();
    });
  });

  describe("response formatting", () => {
    it("should format success responses correctly", async () => {
      spansApi.listSpansGet.mockResolvedValue({ data: tracesQueryResponse.data });
      const queryTool = tools.find((t) => t.name === "query_traces");

      const result = await queryTool.handler({
        serviceName: "api",
        filter: "service:api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(false);
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");
    });
  });
});
