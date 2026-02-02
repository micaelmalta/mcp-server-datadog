/**
 * Tests for Datadog Logs MCP tools.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getLogsTools } from "#tools/logsTools.js";
import {
  clearMocks,
  createTestTimestamps,
  MockApiClient,
} from "#test/helpers.js";
import { logsSearchResponse } from "#test/fixtures/datadogResponses.js";

describe("Logs Tools", () => {
  let tools;
  let mockClient;
  let timestamps;

  beforeEach(() => {
    clearMocks();
    timestamps = createTestTimestamps();
    mockClient = new MockApiClient();
    tools = getLogsTools(mockClient);
  });

  describe("search_logs tool", () => {
    it("should have search_logs tool", () => {
      const searchTool = tools.find((t) => t.name === "search_logs");
      expect(searchTool).toBeDefined();
      expect(searchTool.inputSchema).toBeDefined();
    });

    it("should search logs successfully", async () => {
      mockClient.responses["/logs/events/search"] = {
        data: logsSearchResponse,
        error: null,
      };
      const searchTool = tools.find((t) => t.name === "search_logs");

      const result = await searchTool.handler({
        filter: "service:api status:error",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(false);
      const content = JSON.parse(result.content[0].text);
      expect(content.logs).toBeDefined();
    });

    it("should handle empty filter", async () => {
      mockClient.responses["/logs/events/search"] = {
        data: logsSearchResponse,
        error: null,
      };
      const searchTool = tools.find((t) => t.name === "search_logs");

      const result = await searchTool.handler({
        filter: "",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(false);
    });

    it("should reject when from >= to", async () => {
      const searchTool = tools.find((t) => t.name === "search_logs");

      const result = await searchTool.handler({
        filter: "service:api",
        from: timestamps.toMs,
        to: timestamps.fromMs,
      });

      expect(result.isError).toBe(true);
    });

    it("should enforce page size limits", async () => {
      mockClient.responses["/logs/events/search"] = {
        data: logsSearchResponse,
        error: null,
      };
      const searchTool = tools.find((t) => t.name === "search_logs");

      const result = await searchTool.handler({
        filter: "service:api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
        pageSize: 150,
      });

      expect(result.isError).toBe(false);
    });

    it("should handle client errors", async () => {
      mockClient.responses["/logs/events/search"] = {
        data: null,
        error: new Error("API Error"),
      };
      const searchTool = tools.find((t) => t.name === "search_logs");

      const result = await searchTool.handler({
        filter: "service:api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("get_log_details tool", () => {
    it("should have get_log_details tool", () => {
      const detailsTool = tools.find((t) => t.name === "get_log_details");
      expect(detailsTool).toBeDefined();
      expect(detailsTool.inputSchema).toBeDefined();
    });

    it("should get log details successfully", async () => {
      mockClient.responses["/logs/events"] = {
        data: {
          data: {
            id: "AXvj0ZDn5d08oxCb7t9q",
            attributes: {
              message: "Test log",
              service: "api",
            },
          },
        },
        error: null,
      };
      const detailsTool = tools.find((t) => t.name === "get_log_details");

      const result = await detailsTool.handler({
        logId: "AXvj0ZDn5d08oxCb7t9q",
      });

      expect(result.isError).toBe(false);
    });

    it("should reject empty log ID", async () => {
      const detailsTool = tools.find((t) => t.name === "get_log_details");

      const result = await detailsTool.handler({
        logId: "",
      });

      expect(result.isError).toBe(true);
    });

    it("should handle client errors", async () => {
      mockClient.responses["/logs/events"] = {
        data: null,
        error: new Error("Not found"),
      };
      const detailsTool = tools.find((t) => t.name === "get_log_details");

      const result = await detailsTool.handler({
        logId: "nonexistent",
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("aggregate_logs tool", () => {
    it("should have aggregate_logs tool", () => {
      const aggTool = tools.find((t) => t.name === "aggregate_logs");
      expect(aggTool).toBeDefined();
      expect(aggTool.inputSchema).toBeDefined();
    });

    it("should aggregate logs with avg", async () => {
      mockClient.responses["/logs/events/aggregate"] = {
        data: { aggregation: { avg: 42.5 } },
        error: null,
      };
      const aggTool = tools.find((t) => t.name === "aggregate_logs");

      const result = await aggTool.handler({
        filter: "service:api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
        aggregationType: "avg",
      });

      expect(result.isError).toBe(false);
    });

    it("should aggregate logs with max", async () => {
      mockClient.responses["/logs/events/aggregate"] = {
        data: { aggregation: { max: 100 } },
        error: null,
      };
      const aggTool = tools.find((t) => t.name === "aggregate_logs");

      const result = await aggTool.handler({
        filter: "service:api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
        aggregationType: "max",
      });

      expect(result.isError).toBe(false);
    });

    it("should reject invalid aggregation type", async () => {
      const aggTool = tools.find((t) => t.name === "aggregate_logs");

      const result = await aggTool.handler({
        filter: "service:api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
        aggregationType: "invalid",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Invalid aggregation type");
    });

    it("should reject when from >= to", async () => {
      const aggTool = tools.find((t) => t.name === "aggregate_logs");

      const result = await aggTool.handler({
        filter: "service:api",
        from: timestamps.toMs,
        to: timestamps.fromMs,
        aggregationType: "avg",
      });

      expect(result.isError).toBe(true);
    });

    it("should handle client errors", async () => {
      mockClient.responses["/logs/events/aggregate"] = {
        data: null,
        error: new Error("API Error"),
      };
      const aggTool = tools.find((t) => t.name === "aggregate_logs");

      const result = await aggTool.handler({
        filter: "service:api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
        aggregationType: "avg",
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

  describe("error responses", () => {
    it("should format errors correctly", async () => {
      const searchTool = tools.find((t) => t.name === "search_logs");

      const result = await searchTool.handler({
        filter: "service:api",
        from: timestamps.toMs,
        to: timestamps.fromMs,
      });

      expect(result.isError).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");
    });

    it("should format success responses correctly", async () => {
      mockClient.responses["/logs/events/search"] = {
        data: logsSearchResponse,
        error: null,
      };
      const searchTool = tools.find((t) => t.name === "search_logs");

      const result = await searchTool.handler({
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
