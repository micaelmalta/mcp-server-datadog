/**
 * Tests for Datadog Monitors API client.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MonitorsClient } from "#clients/monitorsClient.js";
import { mockDatadogApi } from "#test/mocks/datadogApi.js";
import {
  createMockConfig,
  assertValidResponse,
} from "#test/helpers.js";
import {
  monitorsListResponse,
  monitorStatusResponse,
} from "#test/fixtures/datadogResponses.js";

describe("MonitorsClient", () => {
  let client;
  const { monitorsApi } = mockDatadogApi;

  beforeEach(() => {
    vi.mocked(monitorsApi.listMonitors).mockReset();
    vi.mocked(monitorsApi.getMonitor).mockReset();
    vi.mocked(monitorsApi.searchMonitors).mockReset();
    vi.mocked(monitorsApi.searchMonitorGroups).mockReset();
    client = new MonitorsClient(createMockConfig());
  });

  describe("listMonitors", () => {
    it("should list all monitors", async () => {
      monitorsApi.listMonitors.mockResolvedValue(monitorsListResponse);

      const { data, error } = await client.listMonitors();

      assertValidResponse({ data, error }, false);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it("should list monitors without filters", async () => {
      monitorsApi.listMonitors.mockResolvedValue(monitorsListResponse);

      await client.listMonitors({});

      expect(monitorsApi.listMonitors).toHaveBeenCalledWith({});
    });

    it("should filter by monitor name", async () => {
      monitorsApi.listMonitors.mockResolvedValue([monitorsListResponse[0]]);

      await client.listMonitors({ name: "High CPU" });

      expect(monitorsApi.listMonitors).toHaveBeenCalledWith(
        expect.objectContaining({ name: "High CPU" })
      );
    });

    it("should filter by monitor type", async () => {
      monitorsApi.listMonitors.mockResolvedValue([monitorsListResponse[0]]);

      await client.listMonitors({ monitorType: "metric alert" });

      expect(monitorsApi.listMonitors).toHaveBeenCalledWith(
        expect.objectContaining({ monitorTags: "metric alert" })
      );
    });

    it("should filter by tags", async () => {
      monitorsApi.listMonitors.mockResolvedValue([monitorsListResponse[0]]);

      await client.listMonitors({
        tags: ["env:prod", "service:api"],
      });

      expect(monitorsApi.listMonitors).toHaveBeenCalledWith(
        expect.objectContaining({ tags: "env:prod,service:api" })
      );
    });

    it("should support multiple filters", async () => {
      monitorsApi.listMonitors.mockResolvedValue([monitorsListResponse[0]]);

      await client.listMonitors({
        name: "CPU",
        monitorType: "metric alert",
        tags: ["env:prod"],
      });

      expect(monitorsApi.listMonitors).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "CPU",
          monitorTags: "metric alert",
          tags: "env:prod",
        })
      );
    });

    it("should handle empty monitors list", async () => {
      monitorsApi.listMonitors.mockResolvedValue([]);

      const { data, error } = await client.listMonitors();

      assertValidResponse({ data, error }, false);
      expect(data).toHaveLength(0);
    });

    it("should handle API errors", async () => {
      const err = Object.assign(new Error("Unauthorized"), { statusCode: 401 });
      monitorsApi.listMonitors.mockRejectedValue(err);

      const { data, error } = await client.listMonitors();

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(401);
    });

    it("should handle single tag filter", async () => {
      monitorsApi.listMonitors.mockResolvedValue([monitorsListResponse[0]]);

      await client.listMonitors({
        tags: ["env:prod"],
      });

      expect(monitorsApi.listMonitors).toHaveBeenCalledWith(
        expect.objectContaining({ tags: "env:prod" })
      );
    });

    it("should ignore non-array tags", async () => {
      monitorsApi.listMonitors.mockResolvedValue([monitorsListResponse[0]]);

      await client.listMonitors({
        tags: "env:prod", // Should be ignored since not an array
      });

      expect(monitorsApi.listMonitors).toHaveBeenCalledWith({});
    });
  });

  describe("getMonitorStatus", () => {
    it("should get monitor status successfully", async () => {
      monitorsApi.getMonitor.mockResolvedValue(monitorStatusResponse);

      const { data, error } = await client.getMonitorStatus(1234567);

      assertValidResponse({ data, error }, false);
      expect(data.id).toBe(1234567);
      expect(data.overall_state).toBeDefined();
    });

    it("should handle numeric zero monitor ID", async () => {
      monitorsApi.getMonitor.mockResolvedValue(monitorStatusResponse);

      const { data, error } = await client.getMonitorStatus(0);

      assertValidResponse({ data, error }, false);
    });

    it("should reject null monitor ID", async () => {
      const { data, error } = await client.getMonitorStatus(null);

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Monitor ID is required");
    });

    it("should reject undefined monitor ID", async () => {
      const { data, error } = await client.getMonitorStatus(undefined);

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Monitor ID is required");
    });

    it("should call getMonitor with monitor ID", async () => {
      monitorsApi.getMonitor.mockResolvedValue(monitorStatusResponse);

      await client.getMonitorStatus(1234567, { from: 0, to: 0 });

      expect(monitorsApi.getMonitor).toHaveBeenCalledWith({ monitorId: 1234567 });
    });

    it("should handle 404 not found", async () => {
      const err = Object.assign(new Error("Not Found"), { statusCode: 404 });
      monitorsApi.getMonitor.mockRejectedValue(err);

      const { data, error } = await client.getMonitorStatus(99999999);

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(404);
    });

    it("should handle API errors", async () => {
      const err = Object.assign(new Error("Internal Server Error"), {
        statusCode: 500,
      });
      monitorsApi.getMonitor.mockRejectedValue(err);

      const { data, error } = await client.getMonitorStatus(1234567);

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(500);
    });
  });

  describe("getMonitorDowntime", () => {
    it("should get monitor downtime successfully", async () => {
      monitorsApi.getMonitor.mockResolvedValue({
        downtime_ids: [123, 456],
      });

      const { data, error } = await client.getMonitorDowntime(1234567);

      assertValidResponse({ data, error }, false);
      expect(data.downtime_ids).toBeDefined();
    });

    it("should handle numeric zero monitor ID", async () => {
      monitorsApi.getMonitor.mockResolvedValue({ downtime_ids: [] });

      const { data, error } = await client.getMonitorDowntime(0);

      assertValidResponse({ data, error }, false);
    });

    it("should reject null monitor ID", async () => {
      const { data, error } = await client.getMonitorDowntime(null);

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Monitor ID is required");
    });

    it("should handle no downtime", async () => {
      monitorsApi.getMonitor.mockResolvedValue({ downtime_ids: [] });

      const { data, error } = await client.getMonitorDowntime(1234567);

      assertValidResponse({ data, error }, false);
      expect(data.downtime_ids).toHaveLength(0);
    });

    it("should handle API errors", async () => {
      const err = Object.assign(new Error("Forbidden"), { statusCode: 403 });
      monitorsApi.getMonitor.mockRejectedValue(err);

      const { data, error } = await client.getMonitorDowntime(1234567);

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(403);
    });
  });

  describe("searchMonitors", () => {
    it("should search monitors successfully", async () => {
      monitorsApi.searchMonitors.mockResolvedValue({
        monitors: monitorsListResponse,
        count: monitorsListResponse.length,
      });

      const { data, error } = await client.searchMonitors("CPU");

      assertValidResponse({ data, error }, false);
      expect(data.monitors).toBeDefined();
    });

    it("should include search query", async () => {
      monitorsApi.searchMonitors.mockResolvedValue({ monitors: [], count: 0 });

      await client.searchMonitors("CPU");

      expect(monitorsApi.searchMonitors).toHaveBeenCalledWith(
        expect.objectContaining({ query: "CPU" })
      );
    });

    it("should reject empty search query", async () => {
      const { data, error } = await client.searchMonitors("");

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Search query is required");
    });

    it("should reject null search query", async () => {
      const { data, error } = await client.searchMonitors(null);

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Search query is required");
    });

    it("should call searchMonitors with query", async () => {
      monitorsApi.searchMonitors.mockResolvedValue({ monitors: [], count: 0 });

      await client.searchMonitors("CPU");

      expect(monitorsApi.searchMonitors).toHaveBeenCalledWith({ query: "CPU" });
    });

    it("should support custom page size", async () => {
      monitorsApi.searchMonitors.mockResolvedValue({ monitors: [], count: 0 });

      await client.searchMonitors("CPU", { pageSize: 50 });

      expect(monitorsApi.searchMonitors).toHaveBeenCalledWith(
        expect.objectContaining({ query: "CPU" })
      );
    });

    it("should handle no search results", async () => {
      monitorsApi.searchMonitors.mockResolvedValue({ monitors: [], count: 0 });

      const { data, error } = await client.searchMonitors("nonexistent");

      assertValidResponse({ data, error }, false);
      expect(data.monitors).toHaveLength(0);
    });

    it("should handle API errors", async () => {
      const err = Object.assign(new Error("Bad Request"), { statusCode: 400 });
      monitorsApi.searchMonitors.mockRejectedValue(err);

      const { data, error } = await client.searchMonitors("CPU");

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(400);
    });
  });

  describe("getMonitor", () => {
    it("should get monitor by ID successfully", async () => {
      monitorsApi.getMonitor.mockResolvedValue(monitorsListResponse[0]);

      const { data, error } = await client.getMonitor(1234567);

      assertValidResponse({ data, error }, false);
      expect(data.id).toBe(1234567);
      expect(data.name).toBeDefined();
    });

    it("should handle numeric zero monitor ID", async () => {
      monitorsApi.getMonitor.mockResolvedValue({ id: 0, name: "Test" });

      const { data, error } = await client.getMonitor(0);

      assertValidResponse({ data, error }, false);
    });

    it("should reject null monitor ID", async () => {
      const { data, error } = await client.getMonitor(null);

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Monitor ID is required");
    });

    it("should reject undefined monitor ID", async () => {
      const { data, error } = await client.getMonitor(undefined);

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Monitor ID is required");
    });

    it("should handle 404 not found", async () => {
      const err = Object.assign(new Error("Not Found"), { statusCode: 404 });
      monitorsApi.getMonitor.mockRejectedValue(err);

      const { data, error } = await client.getMonitor(99999999);

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(404);
    });

    it("should handle API errors", async () => {
      const err = Object.assign(new Error("Unauthorized"), { statusCode: 401 });
      monitorsApi.getMonitor.mockRejectedValue(err);

      const { data, error } = await client.getMonitor(1234567);

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(401);
    });

    it("should return full monitor details", async () => {
      monitorsApi.getMonitor.mockResolvedValue(monitorsListResponse[0]);

      const { data } = await client.getMonitor(1234567);

      expect(data.type).toBeDefined();
      expect(data.query).toBeDefined();
      expect(data.message).toBeDefined();
      expect(data.tags).toBeDefined();
    });
  });

  describe("getMonitorGroups", () => {
    it("should get monitor groups successfully", async () => {
      monitorsApi.searchMonitorGroups.mockResolvedValue({
        groups: {
          "host:web-01": { status: "OK" },
          "host:web-02": { status: "ALERT" },
        },
      });

      const { data, error } = await client.getMonitorGroups(1234567);

      assertValidResponse({ data, error }, false);
      expect(data.groups).toBeDefined();
    });

    it("should handle numeric zero monitor ID", async () => {
      monitorsApi.searchMonitorGroups.mockResolvedValue({ groups: {} });

      const { data, error } = await client.getMonitorGroups(0);

      assertValidResponse({ data, error }, false);
    });

    it("should reject null monitor ID", async () => {
      const { data, error } = await client.getMonitorGroups(null);

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Monitor ID is required");
    });

    it("should reject undefined monitor ID", async () => {
      const { data, error } = await client.getMonitorGroups(undefined);

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Monitor ID is required");
    });

    it("should handle multiple groups", async () => {
      monitorsApi.searchMonitorGroups.mockResolvedValue({
        groups: {
          "host:web-01": { status: "OK" },
          "host:web-02": { status: "OK" },
          "host:db-01": { status: "ALERT" },
        },
      });

      const { data } = await client.getMonitorGroups(1234567);

      expect(Object.keys(data.groups)).toHaveLength(3);
    });

    it("should handle empty groups", async () => {
      monitorsApi.searchMonitorGroups.mockResolvedValue({ groups: {} });

      const { data, error } = await client.getMonitorGroups(1234567);

      assertValidResponse({ data, error }, false);
      expect(Object.keys(data.groups)).toHaveLength(0);
    });

    it("should handle API errors", async () => {
      const err = Object.assign(new Error("Internal Server Error"), {
        statusCode: 500,
      });
      monitorsApi.searchMonitorGroups.mockRejectedValue(err);

      const { data, error } = await client.getMonitorGroups(1234567);

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(500);
    });
  });

  describe("API integration", () => {
    it("should store config (apiKey, appKey)", () => {
      const config = createMockConfig();
      expect(client.apiKey).toBe(config.apiKey);
      expect(client.appKey).toBe(config.appKey);
    });

    it("should support custom site domain", () => {
      const customClient = new MonitorsClient({
        ...createMockConfig(),
        site: "datadoghq.eu",
      });

      expect(customClient.site).toBe("datadoghq.eu");
    });
  });

  describe("error handling", () => {
    it("should handle 401 unauthorized", async () => {
      const err = Object.assign(new Error("Unauthorized"), { statusCode: 401 });
      monitorsApi.listMonitors.mockRejectedValue(err);

      const { data: _data, error } = await client.listMonitors();

      expect(error.statusCode).toBe(401);
    });

    it("should handle 403 forbidden", async () => {
      const err = Object.assign(new Error("Forbidden"), { statusCode: 403 });
      monitorsApi.listMonitors.mockRejectedValue(err);

      const { data: _data, error } = await client.listMonitors();

      expect(error.statusCode).toBe(403);
    });

    it("should handle 429 rate limit", async () => {
      const err = Object.assign(new Error("Too Many Requests"), {
        statusCode: 429,
      });
      monitorsApi.getMonitor.mockRejectedValue(err);

      const { data: _data, error } = await client.getMonitor(1234567);

      expect(error.statusCode).toBe(429);
    });

    it("should handle 500 server error", async () => {
      const err = Object.assign(new Error("Internal Server Error"), {
        statusCode: 500,
      });
      monitorsApi.listMonitors.mockRejectedValue(err);

      const { data: _data, error } = await client.listMonitors();

      expect(error.statusCode).toBe(500);
    });

    it("should preserve error details", async () => {
      const rawError = Object.assign(new Error("Bad Request"), {
        statusCode: 400,
      });
      monitorsApi.listMonitors.mockRejectedValue(rawError);

      const { data: _data, error } = await client.listMonitors();

      expect(error.originalError).toBe(rawError);
    });
  });

  describe("monitor states", () => {
    it("should handle OK monitor state", async () => {
      monitorsApi.getMonitor.mockResolvedValue({
        ...monitorsListResponse[0],
        overall_state: "OK",
      });

      const { data } = await client.getMonitor(1234567);

      expect(data.overall_state).toBe("OK");
    });

    it("should handle ALERT monitor state", async () => {
      monitorsApi.getMonitor.mockResolvedValue({
        ...monitorsListResponse[0],
        overall_state: "ALERT",
      });

      const { data } = await client.getMonitor(1234567);

      expect(data.overall_state).toBe("ALERT");
    });

    it("should handle NO_DATA monitor state", async () => {
      monitorsApi.getMonitor.mockResolvedValue({
        ...monitorsListResponse[0],
        overall_state: "NO_DATA",
      });

      const { data } = await client.getMonitor(1234567);

      expect(data.overall_state).toBe("NO_DATA");
    });

    it("should handle group-level states", async () => {
      const statusWithGroupStates = {
        ...monitorStatusResponse,
        state: {
          groups: {
            "host:web-01": "OK",
            "host:web-02": "ALERT",
            "host:db-01": "NO_DATA",
          },
        },
      };
      monitorsApi.getMonitor.mockResolvedValue(statusWithGroupStates);

      const { data } = await client.getMonitorStatus(1234567);

      expect(data.state.groups["host:web-01"]).toBe("OK");
      expect(data.state.groups["host:web-02"]).toBe("ALERT");
      expect(data.state.groups["host:db-01"]).toBe("NO_DATA");
    });
  });

  describe("edge cases", () => {
    it("should handle very large monitor IDs", async () => {
      monitorsApi.getMonitor.mockResolvedValue(monitorsListResponse[0]);

      const { data, error } = await client.getMonitor(9999999999);

      assertValidResponse({ data, error }, false);
    });

    it("should handle monitor names with special characters", async () => {
      monitorsApi.listMonitors.mockResolvedValue([]);

      await client.listMonitors({ name: "CPU (%) Alert" });

      expect(monitorsApi.listMonitors).toHaveBeenCalledWith(
        expect.objectContaining({ name: "CPU (%) Alert" })
      );
    });

    it("should handle many tags in filter", async () => {
      monitorsApi.listMonitors.mockResolvedValue([]);

      const manyTags = Array.from({ length: 10 }, (_, i) => `tag${i}:value${i}`);
      await client.listMonitors({ tags: manyTags });

      expect(monitorsApi.listMonitors).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: manyTags.join(","),
        })
      );
    });

    it("should handle monitor type variations", async () => {
      monitorsApi.listMonitors.mockResolvedValue([]);

      const types = [
        "metric alert",
        "service check",
        "event alert",
        "composite",
      ];

      for (const type of types) {
        await client.listMonitors({ monitorType: type });
      }

      expect(monitorsApi.listMonitors).toHaveBeenCalledTimes(types.length);
    });
  });
});
