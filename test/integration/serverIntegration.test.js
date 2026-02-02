/**
 * Integration tests for MCP Datadog server.
 */

import { describe, it, expect, beforeEach } from "vitest";
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
import {
  mockSuccess,
  mockError,
  clearMocks,
  createMockConfig,
  createTestTimestamps,
} from "#test/helpers.js";
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

  beforeEach(() => {
    clearMocks();
    config = createMockConfig();
    timestamps = createTestTimestamps();
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
      mockSuccess(metricsQueryResponse);
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
      mockSuccess(logsSearchResponse);
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
      mockSuccess(eventsSearchResponse);
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
      mockSuccess(monitorsListResponse);
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
      mockSuccess(tracesQueryResponse);
      const client = new ApmClient(config);
      const tools = getApmTools(client);
      const queryTool = tools.find((t) => t.name === "query_traces");

      const result = await queryTool.handler({
        filter: "service:api",
        from: timestamps.fromMs,
        to: timestamps.toMs,
      });

      expect(result.isError).toBe(false);
    });
  });

  describe("Error Handling Across Services", () => {
    it("should handle 401 errors across all clients", async () => {
      mockError({ status: 401, message: "Unauthorized" });

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
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      // All should be errors
      expect(metricsError).toBeDefined();
      expect(logsError).toBeDefined();
      expect(eventsError).toBeDefined();
      expect(monitorsError).toBeDefined();
      expect(apmError).toBeDefined();
    });

    it("should handle 429 rate limit errors gracefully", async () => {
      mockError({ status: 429, message: "Too Many Requests" });

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
      mockError({ status: 500, message: "Internal Server Error" });

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
      mockSuccess(metricsQueryResponse);

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

      expect(client1.client.baseUrl).toContain("datadoghq.com");
      expect(client2.client.baseUrl).toContain("datadoghq.eu");
    });
  });

  describe("Tool Handler Response Format", () => {
    it("should return consistent MCP response format", async () => {
      mockSuccess(metricsQueryResponse);
      const client = new MetricsClient(config);
      const tools = getMetricsTools(client);

      tools.forEach(async (tool) => {
        const handler = tool.handler;
        expect(typeof handler).toBe("function");

        // Verify response structure for error case
        const errorResponse = await handler({});
        expect(errorResponse).toHaveProperty("isError");
        expect(errorResponse).toHaveProperty("content");
        expect(Array.isArray(errorResponse.content)).toBe(true);

        if (errorResponse.content.length > 0) {
          expect(errorResponse.content[0]).toHaveProperty("type");
          expect(errorResponse.content[0]).toHaveProperty("text");
        }
      });
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
    it("should use correct API base URLs", () => {
      const metricsClient = new MetricsClient(config);
      const logsClient = new LogsClient(config);
      const eventsClient = new EventsClient(config);
      const monitorsClient = new MonitorsClient(config);
      const apmClient = new ApmClient(config);

      expect(metricsClient.client.baseUrl).toContain("/api/v1");
      expect(logsClient.client.baseUrl).toContain("/api/v2");
      expect(eventsClient.client.baseUrl).toContain("/api/v1");
      expect(monitorsClient.client.baseUrl).toContain("/api/v1");
      expect(apmClient.client.baseUrl).toContain("/api/v2");
    });

    it("should include authentication headers in all requests", async () => {
      mockSuccess(metricsQueryResponse);

      const client = new MetricsClient(config);
      await client.queryMetrics("system.cpu", timestamps.from, timestamps.to);

      // Headers are set on the client
      expect(client.client.headers["DD-API-KEY"]).toBe(config.apiKey);
      expect(client.client.headers["DD-APPLICATION-KEY"]).toBe(config.appKey);
    });

    it("should support custom site configuration", () => {
      const customConfig = { ...config, site: "datadoghq.eu" };
      const client = new MetricsClient(customConfig);

      expect(client.client.baseUrl).toContain("datadoghq.eu");
    });
  });

  describe("Response Data Consistency", () => {
    it("should return consistent data structure for metrics", async () => {
      mockSuccess(metricsQueryResponse);
      const client = new MetricsClient(config);

      const { data } = await client.queryMetrics(
        "system.cpu",
        timestamps.from,
        timestamps.to
      );

      expect(data.status).toBe("ok");
      expect(Array.isArray(data.series)).toBe(true);
    });

    it("should return consistent data structure for logs", async () => {
      mockSuccess(logsSearchResponse);
      const client = new LogsClient(config);

      const { data } = await client.searchLogs(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      expect(Array.isArray(data.data)).toBe(true);
      expect(data.meta).toBeDefined();
    });

    it("should return consistent data structure for events", async () => {
      mockSuccess(eventsSearchResponse);
      const client = new EventsClient(config);

      const { data } = await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      expect(Array.isArray(data.events)).toBe(true);
    });

    it("should return consistent data structure for monitors", async () => {
      mockSuccess(monitorsListResponse);
      const client = new MonitorsClient(config);

      const { data } = await client.listMonitors();

      expect(Array.isArray(data)).toBe(true);
    });

    it("should return consistent data structure for traces", async () => {
      mockSuccess(tracesQueryResponse);
      const client = new ApmClient(config);

      const { data } = await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe("Timestamp Handling Across Clients", () => {
    it("should handle Unix seconds in appropriate clients", async () => {
      mockSuccess(metricsQueryResponse);
      const client = new MetricsClient(config);

      const { data: _data, error } = await client.queryMetrics(
        "system.cpu",
        timestamps.from,
        timestamps.to
      );

      expect(error).toBeNull();
    });

    it("should handle milliseconds in appropriate clients", async () => {
      mockSuccess(logsSearchResponse);
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
