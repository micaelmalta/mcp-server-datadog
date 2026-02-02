/**
 * Tests for Datadog Events MCP tools.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getEventsTools } from "#tools/eventsTools.js";
import {
  clearMocks,
  createTestTimestamps,
  MockApiClient,
} from "#test/helpers.js";
import { eventsSearchResponse } from "#test/fixtures/datadogResponses.js";

describe("Events Tools", () => {
  let tools;
  let mockClient;
  let timestamps;

  beforeEach(() => {
    clearMocks();
    timestamps = createTestTimestamps();
    mockClient = new MockApiClient();
    tools = getEventsTools(mockClient);
  });

  describe("search_events tool", () => {
    it("should have search_events tool", () => {
      const searchTool = tools.find((t) => t.name === "search_events");
      expect(searchTool).toBeDefined();
    });

    it("should search events successfully", async () => {
      mockClient.responses["/events"] = {
        data: eventsSearchResponse,
        error: null,
      };
      const searchTool = tools.find((t) => t.name === "search_events");

      const result = await searchTool.handler({
        query: "priority:high",
        from: timestamps.from,
        to: timestamps.to,
      });

      expect(result.isError).toBe(false);
    });

    it("should reject when from >= to", async () => {
      const searchTool = tools.find((t) => t.name === "search_events");

      const result = await searchTool.handler({
        query: "priority:high",
        from: timestamps.to,
        to: timestamps.from,
      });

      expect(result.isError).toBe(true);
    });

    it("should handle empty query", async () => {
      mockClient.responses["/events"] = {
        data: eventsSearchResponse,
        error: null,
      };
      const searchTool = tools.find((t) => t.name === "search_events");

      const result = await searchTool.handler({
        query: "",
        from: timestamps.from,
        to: timestamps.to,
      });

      expect(result.isError).toBe(false);
    });
  });

  describe("get_event_details tool", () => {
    it("should have get_event_details tool", () => {
      const detailsTool = tools.find((t) => t.name === "get_event_details");
      expect(detailsTool).toBeDefined();
    });

    it("should get event details successfully", async () => {
      mockClient.responses["/events"] = {
        data: { event: { id: 12345678 } },
        error: null,
      };
      const detailsTool = tools.find((t) => t.name === "get_event_details");

      const result = await detailsTool.handler({
        eventId: 12345678,
      });

      expect(result.isError).toBe(false);
    });

    it("should handle numeric zero event ID", async () => {
      mockClient.responses["/events"] = {
        data: { event: { id: 0 } },
        error: null,
      };
      const detailsTool = tools.find((t) => t.name === "get_event_details");

      const result = await detailsTool.handler({
        eventId: 0,
      });

      expect(result.isError).toBe(false);
    });

    it("should reject null event ID", async () => {
      const detailsTool = tools.find((t) => t.name === "get_event_details");

      const result = await detailsTool.handler({
        eventId: null,
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("tool validation", () => {
    it("should have exactly 2 tools", () => {
      expect(tools).toHaveLength(2);
    });

    it("should have all required properties", () => {
      tools.forEach((tool) => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.handler).toBeDefined();
      });
    });
  });

  describe("error handling", () => {
    it("should format errors correctly", async () => {
      const searchTool = tools.find((t) => t.name === "search_events");

      const result = await searchTool.handler({
        query: "priority:high",
        from: timestamps.to,
        to: timestamps.from,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].type).toBe("text");
    });

    it("should handle client errors", async () => {
      mockClient.responses["/events"] = {
        data: null,
        error: new Error("API Error"),
      };
      const searchTool = tools.find((t) => t.name === "search_events");

      const result = await searchTool.handler({
        query: "priority:high",
        from: timestamps.from,
        to: timestamps.to,
      });

      expect(result.isError).toBe(true);
    });
  });
});
