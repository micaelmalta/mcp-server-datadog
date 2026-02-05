/**
 * Integration tests for MCP Datadog server.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MetricsClient } from "#clients/metricsClient.js";
import { LogsClient } from "#clients/logsClient.js";
import { EventsClient } from "#clients/eventsClient.js";
import { MonitorsClient } from "#clients/monitorsClient.js";
import { ApmClient } from "#clients/apmClient.js";
import { getMetricsTools } from "#tools/metricsTools.js";
import { getLogsTools } from "#tools/logsTools.js";
import { getEventsTools } from "#tools/eventsTools.js";
import { getMonitorsTools } from "#tools/monitorsTools.js";
import { getApmTools } from "#tools/apmTools.js";
import { mockDatadogApi } from "#test/mocks/datadogApi.js";
import { createMockConfig, createTestTimestamps } from "#test/helpers.js";
import {
  metricsQueryResponse,
  logsSearchResponse,
  eventsSearchResponse,
  monitorsListResponse,
  tracesQueryResponse,
} from "#test/fixtures/datadogResponses.js";

describe("MCP Server Integration", () => {
  let config;
  let timestamps;
  const { metricsApi, logsApi, eventsApi, monitorsApi, spansApi } = mockDatadogApi;

  beforeEach(() => {
    config = createMockConfig();
    timestamps = createTestTimestamps();
    vi.mocked(metricsApi.queryMetrics).mockResolvedValue(metricsQueryResponse);
    vi.mocked(logsApi.listLogs).mockResolvedValue(logsSearchResponse);
    vi.mocked(eventsApi.listEvents).mockResolvedValue(eventsSearchResponse);
    vi.mocked(eventsApi.getEvent).mockResolvedValue({ event: { id: 1 } });
    vi.mocked(monitorsApi.listMonitors).mockResolvedValue(monitorsListResponse);
    vi.mocked(spansApi.listSpansGet).mockResolvedValue({
      data: tracesQueryResponse.data,
    });
    vi.mocked(metricsApi.queryMetrics).mockResolvedValue(metricsQueryResponse);
  });

  describe("Metrics Integration", () => {
    it("should initialize metrics client", () => {
      const client = new MetricsClient(config);
      expect(client).toBeDefined();
      expect(client.apiKey).toBe(config.apiKey);
      expect(client.appKey).toBe(config.appKey);
    });

    it("should register all metrics tools", () => {
      const client = new MetricsClient(config);
      const tools = getMetricsTools(client);

      expect(tools).toHaveLength(3);
      expect(tools.map((t) => t.name)).toContain("query_metrics");
      expect(tools.map((t) => t.name)).toContain("get_metric_metadata");
      expect(tools.map((t) => t.name)).toContain("list_metrics");
    });

    it("should invoke metrics tool through client", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
      const client = new MetricsClient(config);
      const tools = getMetricsTools(client);
      const queryTool = tools.find((t) => t.name === "query_metrics");

      const result = await queryTool.handler({
        metricName: "system.cpu",
        from: timestamps.from,
        to: timestamps.to,
      });

      expect(result.isError).toBe(false);
    });
  });

  describe("Logs Integration", () => {
    it("should initialize logs client", () => {
      const client = new LogsClient(config);
      expect(client).toBeDefined();
      expect(client.apiKey).toBe(config.apiKey);
    });

    it("should register all logs tools", () => {
      const client = new LogsClient(config);
      const tools = getLogsTools(client);

      expect(tools).toHaveLength(3);
      expect(tools.map((t) => t.name)).toContain("search_logs");
      expect(tools.map((t) => t.name)).toContain("get_log_details");
      expect(tools.map((t) => t.name)).toContain("aggregate_logs");
    });

    it("should invoke logs tool through client", async () => {
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);
      const client = new LogsClient(config);
      const tools = getLogsTools(client);
      const searchTool = tools.find((t) => t.name === "search_logs");

      const result = await searchTool.handler({
        filter: "service:api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(false);
    });
  });

  describe("Events Integration", () => {
    it("should initialize events client", () => {
      const client = new EventsClient(config);
      expect(client).toBeDefined();
    });

    it("should register all events tools", () => {
      const client = new EventsClient(config);
      const tools = getEventsTools(client);

      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toContain("search_events");
      expect(tools.map((t) => t.name)).toContain("get_event_details");
    });

    it("should invoke events tool through client", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);
      const client = new EventsClient(config);
      const tools = getEventsTools(client);
      const searchTool = tools.find((t) => t.name === "search_events");

      const result = await searchTool.handler({
        query: "priority:high",
        from: timestamps.from,
        to: timestamps.to,
      });

      expect(result.isError).toBe(false);
    });
  });

  describe("Monitors Integration", () => {
    it("should initialize monitors client", () => {
      const client = new MonitorsClient(config);
      expect(client).toBeDefined();
    });

    it("should register all monitors tools", () => {
      const client = new MonitorsClient(config);
      const tools = getMonitorsTools(client);

      expect(tools).toHaveLength(3);
      expect(tools.map((t) => t.name)).toContain("list_monitors");
      expect(tools.map((t) => t.name)).toContain("get_monitor_status");
      expect(tools.map((t) => t.name)).toContain("search_monitors");
    });

    it("should invoke monitors tool through client", async () => {
      monitorsApi.listMonitors.mockResolvedValue(monitorsListResponse);
      const client = new MonitorsClient(config);
      const tools = getMonitorsTools(client);
      const listTool = tools.find((t) => t.name === "list_monitors");

      const result = await listTool.handler({});

      expect(result.isError).toBe(false);
    });
  });

  describe("APM Integration", () => {
    it("should initialize APM client", () => {
      const client = new ApmClient(config);
      expect(client).toBeDefined();
    });

    it("should register all APM tools", () => {
      const client = new ApmClient(config);
      const tools = getApmTools(client);

      expect(tools).toHaveLength(3);
      expect(tools.map((t) => t.name)).toContain("query_traces");
      expect(tools.map((t) => t.name)).toContain("get_service_health");
      expect(tools.map((t) => t.name)).toContain("get_service_dependencies");
    });

    it("should invoke APM tool through client", async () => {
      spansApi.listSpansGet.mockResolvedValue({
        data: tracesQueryResponse.data,
      });
      const client = new ApmClient(config);
      const tools = getApmTools(client);
      const queryTool = tools.find((t) => t.name === "query_traces");

      const result = await queryTool.handler({
        filter: "env:prod",
        from: timestamps.fromMs,
        to: timestamps.toMs,
        serviceName: "api",
      });

      expect(result.isError).toBe(false);
    });
  });

  describe("Error Handling Across Services", () => {
    it("should handle 401 errors across all clients", async () => {
      const err = new Error("Unauthorized");
      err.statusCode = 401;
      metricsApi.queryMetrics.mockRejectedValue(err);
      logsApi.listLogs.mockRejectedValue(err);
      eventsApi.listEvents.mockRejectedValue(err);
      monitorsApi.listMonitors.mockRejectedValue(err);
      spansApi.listSpansGet.mockRejectedValue(err);
      metricsApi.queryMetrics.mockRejectedValue(err);

      const metricsClient = new MetricsClient(config);
      const logsClient = new LogsClient(config);
      const eventsClient = new EventsClient(config);
      const monitorsClient = new MonitorsClient(config);
      const apmClient = new ApmClient(config);

      const { error: metricsError } = await metricsClient.queryMetrics(
        "system.cpu",
        timestamps.from,
        timestamps.to
      );
      const { error: logsError } = await logsClient.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );
      const { error: eventsError } = await eventsClient.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );
      const { error: monitorsError } = await monitorsClient.listMonitors();
      const { error: apmError } = await apmClient.queryTraces(
        "env:prod",
        timestamps.fromMs,
        timestamps.toMs,
        { serviceName: "api" }
      );

      expect(metricsError).toBeDefined();
      expect(logsError).toBeDefined();
      expect(eventsError).toBeDefined();
      expect(monitorsError).toBeDefined();
      expect(apmError).toBeDefined();
    });

    it("should handle 429 rate limit errors gracefully", async () => {
      const err = new Error("Too Many Requests");
      err.statusCode = 429;
      metricsApi.queryMetrics.mockRejectedValue(err);

      const client = new MetricsClient(config);
      const { data: _data, error } = await client.queryMetrics(
        "system.cpu",
        timestamps.from,
        timestamps.to
      );

      expect(error).toBeDefined();
      expect(error.statusCode).toBe(429);
    });

    it("should handle 500 server errors gracefully", async () => {
      const err = new Error("Internal Server Error");
      err.statusCode = 500;
      logsApi.listLogs.mockRejectedValue(err);

      const client = new LogsClient(config);
      const { data: _data, error } = await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      expect(error).toBeDefined();
      expect(error.statusCode).toBe(500);
    });
  });

  describe("Multi-Client Workflows", () => {
    it("should support concurrent client requests", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);

      const metricsClient = new MetricsClient(config);
      const logsClient = new LogsClient(config);
      const eventsClient = new EventsClient(config);

      const promises = [
        metricsClient.queryMetrics("system.cpu", timestamps.from, timestamps.to),
        logsClient.searchLogs("service:api", timestamps.fromMs, timestamps.toMs),
        eventsClient.searchEvents("priority:high", timestamps.from, timestamps.to),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toHaveProperty("data");
        expect(result).toHaveProperty("error");
      });
    });

    it("should handle different client configurations", () => {
      const config1 = createMockConfig();
      const config2 = { ...createMockConfig(), site: "datadoghq.eu" };

      const client1 = new MetricsClient(config1);
      const client2 = new MetricsClient(config2);

      expect(client1.site).toBe("datadoghq.com");
      expect(client2.site).toBe("datadoghq.eu");
    });
  });

  describe("Tool Handler Response Format", () => {
    it("should return consistent MCP response format", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
      const client = new MetricsClient(config);
      const tools = getMetricsTools(client);

      for (const tool of tools) {
        const handler = tool.handler;
        expect(typeof handler).toBe("function");

        const errorResponse = await handler({});
        expect(errorResponse).toHaveProperty("isError");
        expect(errorResponse).toHaveProperty("content");
        expect(Array.isArray(errorResponse.content)).toBe(true);

        if (errorResponse.content.length > 0) {
          expect(errorResponse.content[0]).toHaveProperty("type");
          expect(errorResponse.content[0]).toHaveProperty("text");
        }
      }
    });
  });

  describe("Tool Input Validation", () => {
    it("should validate required fields for all tools", async () => {
      const metricsClient = new MetricsClient(config);
      const metricsTools = getMetricsTools(metricsClient);

      const queryTool = metricsTools.find((t) => t.name === "query_metrics");
      const schema = queryTool.inputSchema;

      expect(schema.required).toContain("metricName");
      expect(schema.required).toContain("from");
      expect(schema.required).toContain("to");
    });

    it("should have property descriptions for all inputs", () => {
      const metricsClient = new MetricsClient(config);
      const tools = getMetricsTools(metricsClient);

      tools.forEach((tool) => {
        Object.values(tool.inputSchema.properties).forEach((prop) => {
          expect(prop.description).toBeDefined();
        });
      });
    });
  });

  describe("API Client Configuration", () => {
    it("should use correct site configuration", () => {
      const metricsClient = new MetricsClient(config);
      const logsClient = new LogsClient(config);
      const eventsClient = new EventsClient(config);
      const monitorsClient = new MonitorsClient(config);
      const apmClient = new ApmClient(config);

      expect(metricsClient.site).toBe("datadoghq.com");
      expect(logsClient.site).toBe("datadoghq.com");
      expect(eventsClient.site).toBe("datadoghq.com");
      expect(monitorsClient.site).toBe("datadoghq.com");
      expect(apmClient.site).toBe("datadoghq.com");
    });

    it("should support custom site configuration", () => {
      const customConfig = { ...config, site: "datadoghq.eu" };
      const client = new MetricsClient(customConfig);

      expect(client.site).toBe("datadoghq.eu");
    });
  });

  describe("Response Data Consistency", () => {
    it("should return consistent data structure for metrics", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
      const client = new MetricsClient(config);

      const { data } = await client.queryMetrics("system.cpu", timestamps.from, timestamps.to);

      expect(data.status).toBe("ok");
      expect(Array.isArray(data.series)).toBe(true);
    });

    it("should return consistent data structure for logs", async () => {
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);
      const client = new LogsClient(config);

      const { data } = await client.searchLogs("service:api", timestamps.fromMs, timestamps.toMs);

      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should return consistent data structure for events", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);
      const client = new EventsClient(config);

      const { data } = await client.searchEvents("priority:high", timestamps.from, timestamps.to);

      expect(Array.isArray(data.events)).toBe(true);
    });

    it("should return consistent data structure for monitors", async () => {
      monitorsApi.listMonitors.mockResolvedValue(monitorsListResponse);
      const client = new MonitorsClient(config);

      const { data } = await client.listMonitors();

      expect(Array.isArray(data)).toBe(true);
    });

    it("should return consistent data structure for traces", async () => {
      spansApi.listSpansGet.mockResolvedValue({
        data: tracesQueryResponse.data,
      });
      const client = new ApmClient(config);

      const { data } = await client.queryTraces("env:prod", timestamps.fromMs, timestamps.toMs, {
        serviceName: "api",
      });

      expect(data.traces).toBeDefined();
      expect(Array.isArray(data.traces)).toBe(true);
    });
  });

  describe("Timestamp Handling Across Clients", () => {
    it("should handle Unix seconds in appropriate clients", async () => {
      metricsApi.queryMetrics.mockResolvedValue(metricsQueryResponse);
      const client = new MetricsClient(config);

      const { data: _data, error } = await client.queryMetrics(
        "system.cpu",
        timestamps.from,
        timestamps.to
      );

      expect(error).toBeNull();
    });

    it("should handle milliseconds in appropriate clients", async () => {
      logsApi.listLogs.mockResolvedValue(logsSearchResponse);
      const client = new LogsClient(config);

      const { data: _data, error } = await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      expect(error).toBeNull();
    });
  });
});
