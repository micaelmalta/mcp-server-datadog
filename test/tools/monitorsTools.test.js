/**
 * Tests for Datadog Monitors MCP tools.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getMonitorsTools } from "#tools/monitorsTools.js";
import { monitorsListResponse, monitorStatusResponse } from "#test/fixtures/datadogResponses.js";

describe("Monitors Tools", () => {
  let tools;
  let mockClient;

  beforeEach(() => {
    mockClient = {
      listMonitors: vi.fn(),
      getMonitorStatus: vi.fn(),
      searchMonitors: vi.fn(),
    };
    tools = getMonitorsTools(mockClient);
  });

  describe("list_monitors tool", () => {
    it("should have list_monitors tool", () => {
      const listTool = tools.find((t) => t.name === "list_monitors");
      expect(listTool).toBeDefined();
    });

    it("should list monitors successfully", async () => {
      mockClient.listMonitors.mockResolvedValue({
        data: monitorsListResponse,
        error: null,
      });
      const listTool = tools.find((t) => t.name === "list_monitors");

      const result = await listTool.handler({});

      expect(result.isError).toBe(false);
    });

    it("should filter monitors by name", async () => {
      mockClient.listMonitors.mockResolvedValue({
        data: [monitorsListResponse[0]],
        error: null,
      });
      const listTool = tools.find((t) => t.name === "list_monitors");

      const result = await listTool.handler({
        name: "High CPU",
      });

      expect(result.isError).toBe(false);
    });

    it("should filter monitors by status", async () => {
      mockClient.listMonitors.mockResolvedValue({
        data: [monitorsListResponse[0]],
        error: null,
      });
      const listTool = tools.find((t) => t.name === "list_monitors");

      const result = await listTool.handler({
        status: "OK",
      });

      expect(result.isError).toBe(false);
    });

    it("should handle multiple filters", async () => {
      mockClient.listMonitors.mockResolvedValue({
        data: [monitorsListResponse[0]],
        error: null,
      });
      const listTool = tools.find((t) => t.name === "list_monitors");

      const result = await listTool.handler({
        name: "CPU",
        status: "OK",
        tags: ["env:prod"],
      });

      expect(result.isError).toBe(false);
    });
  });

  describe("get_monitor_status tool", () => {
    it("should have get_monitor_status tool", () => {
      const statusTool = tools.find((t) => t.name === "get_monitor_status");
      expect(statusTool).toBeDefined();
    });

    it("should get monitor status successfully", async () => {
      mockClient.getMonitorStatus.mockResolvedValue({
        data: monitorStatusResponse,
        error: null,
      });
      const statusTool = tools.find((t) => t.name === "get_monitor_status");

      const result = await statusTool.handler({
        monitorId: 1234567,
      });

      expect(result.isError).toBe(false);
    });

    it("should reject null monitor ID", async () => {
      const statusTool = tools.find((t) => t.name === "get_monitor_status");

      const result = await statusTool.handler({
        monitorId: null,
      });

      expect(result.isError).toBe(true);
    });

    it("should accept zero monitor ID", async () => {
      mockClient.getMonitorStatus.mockResolvedValue({
        data: monitorStatusResponse,
        error: null,
      });
      const statusTool = tools.find((t) => t.name === "get_monitor_status");

      const result = await statusTool.handler({
        monitorId: 0,
      });

      expect(result.isError).toBe(false);
    });
  });

  describe("search_monitors tool", () => {
    it("should have search_monitors tool", () => {
      const searchTool = tools.find((t) => t.name === "search_monitors");
      expect(searchTool).toBeDefined();
    });

    it("should search monitors successfully", async () => {
      mockClient.searchMonitors.mockResolvedValue({
        data: { monitors: monitorsListResponse },
        error: null,
      });
      const searchTool = tools.find((t) => t.name === "search_monitors");

      const result = await searchTool.handler({
        query: "CPU",
      });

      expect(result.isError).toBe(false);
    });

    it("should reject empty query", async () => {
      const searchTool = tools.find((t) => t.name === "search_monitors");

      const result = await searchTool.handler({
        query: "",
      });

      expect(result.isError).toBe(true);
    });

    it("should support custom page size", async () => {
      mockClient.searchMonitors.mockResolvedValue({
        data: { monitors: [] },
        error: null,
      });
      const searchTool = tools.find((t) => t.name === "search_monitors");

      const result = await searchTool.handler({
        query: "CPU",
        pageSize: 50,
      });

      expect(result.isError).toBe(false);
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
      const searchTool = tools.find((t) => t.name === "search_monitors");

      const result = await searchTool.handler({
        query: "",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].type).toBe("text");
    });

    it("should handle client errors", async () => {
      mockClient.listMonitors.mockResolvedValue({
        data: null,
        error: new Error("API Error"),
      });
      const listTool = tools.find((t) => t.name === "list_monitors");

      const result = await listTool.handler({});

      expect(result.isError).toBe(true);
    });
  });
});
