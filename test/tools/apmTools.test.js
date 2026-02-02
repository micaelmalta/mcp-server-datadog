/**
 * Tests for Datadog APM MCP tools.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getApmTools } from "#tools/apmTools.js";
import {
  clearMocks,
  createTestTimestamps,
  MockApiClient,
} from "#test/helpers.js";
import {
  tracesQueryResponse,
  serviceHealthResponse,
  serviceDependenciesResponse,
} from "#test/fixtures/datadogResponses.js";

describe("APM Tools", () => {
  let tools;
  let mockClient;
  let timestamps;

  beforeEach(() => {
    clearMocks();
    timestamps = createTestTimestamps();
    mockClient = new MockApiClient();
    tools = getApmTools(mockClient);
  });

  describe("query_traces tool", () => {
    it("should have query_traces tool", () => {
      const queryTool = tools.find((t) => t.name === "query_traces");
      expect(queryTool).toBeDefined();
    });

    it("should query traces successfully", async () => {
      mockClient.responses["/traces"] = {
        data: tracesQueryResponse,
        error: null,
      };
      const queryTool = tools.find((t) => t.name === "query_traces");

      const result = await queryTool.handler({
        filter: "service:api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(false);
    });

    it("should reject when from >= to", async () => {
      const queryTool = tools.find((t) => t.name === "query_traces");

      const result = await queryTool.handler({
        filter: "service:api",
        from: timestamps.toMs,
        to: timestamps.fromMs,
      });

      expect(result.isError).toBe(true);
    });

    it("should handle empty filter", async () => {
      mockClient.responses["/traces"] = {
        data: tracesQueryResponse,
        error: null,
      };
      const queryTool = tools.find((t) => t.name === "query_traces");

      const result = await queryTool.handler({
        filter: "",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(false);
    });

    it("should support custom page size", async () => {
      mockClient.responses["/traces"] = {
        data: tracesQueryResponse,
        error: null,
      };
      const queryTool = tools.find((t) => t.name === "query_traces");

      const result = await queryTool.handler({
        filter: "service:api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
        pageSize: 50,
      });

      expect(result.isError).toBe(false);
    });

    it("should support custom sort field", async () => {
      mockClient.responses["/traces"] = {
        data: tracesQueryResponse,
        error: null,
      };
      const queryTool = tools.find((t) => t.name === "query_traces");

      const result = await queryTool.handler({
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
      mockClient.responses["/service/health"] = {
        data: serviceHealthResponse,
        error: null,
      };
      const healthTool = tools.find((t) => t.name === "get_service_health");

      const result = await healthTool.handler({
        serviceName: "api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(false);
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
      mockClient.responses["/service/dependencies"] = {
        data: serviceDependenciesResponse,
        error: null,
      };
      const depsTool = tools.find((t) => t.name === "get_service_dependencies");

      const result = await depsTool.handler({
        serviceName: "api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(false);
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
        filter: "service:api",
        from: timestamps.toMs,
        to: timestamps.fromMs,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].type).toBe("text");
    });

    it("should handle client errors", async () => {
      mockClient.responses["/service/health"] = {
        data: null,
        error: new Error("API Error"),
      };
      const healthTool = tools.find((t) => t.name === "get_service_health");

      const result = await healthTool.handler({
        serviceName: "api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("response formatting", () => {
    it("should format success responses correctly", async () => {
      mockClient.responses["/traces"] = {
        data: tracesQueryResponse,
        error: null,
      };
      const queryTool = tools.find((t) => t.name === "query_traces");

      const result = await queryTool.handler({
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
