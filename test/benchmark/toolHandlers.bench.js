/**
 * Benchmark tool handlers (hot path) with mocked clients.
 * Run: npm test -- test/benchmark --run
 * Establishes baseline for in-process + mock cost; real latency is dominated by Datadog API I/O.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getMetricsTools } from "#tools/metricsTools.js";
import { getLogsTools } from "#tools/logsTools.js";
import { getEventsTools } from "#tools/eventsTools.js";
import { getMonitorsTools } from "#tools/monitorsTools.js";
import { getApmTools } from "#tools/apmTools.js";
import { MetricsClient } from "#clients/metricsClient.js";
import { LogsClient } from "#clients/logsClient.js";
import { EventsClient } from "#clients/eventsClient.js";
import { MonitorsClient } from "#clients/monitorsClient.js";
import { ApmClient } from "#clients/apmClient.js";
import { mockDatadogApi } from "#test/mocks/datadogApi.js";
import { createMockConfig, createTestTimestamps } from "#test/helpers.js";
import {
  metricsQueryResponse,
  logsSearchResponse,
  eventsSearchResponse,
  monitorsListResponse,
  tracesQueryResponse,
} from "#test/fixtures/datadogResponses.js";

const ITERATIONS = 100;

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const i = (p / 100) * (sortedArr.length - 1);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sortedArr[lo] : sortedArr[lo] + (i - lo) * (sortedArr[hi] - sortedArr[lo]);
}

describe("Tool handler benchmark (mocked)", () => {
  let timestamps;
  let metricsTools;
  let logsTools;
  let eventsTools;
  let monitorsTools;
  let apmTools;

  beforeEach(() => {
    timestamps = createTestTimestamps();
    const config = createMockConfig();

    vi.mocked(mockDatadogApi.metricsApi.queryMetrics).mockResolvedValue(metricsQueryResponse);
    vi.mocked(mockDatadogApi.metricsApi.getMetricMetadata).mockResolvedValue({
      type: "gauge",
      short_name: "system.cpu",
    });
    vi.mocked(mockDatadogApi.metricsApi.listMetrics).mockResolvedValue({
      data: { data: [{ id: "system.cpu", type: "gauge" }] },
    });
    vi.mocked(mockDatadogApi.logsApi.listLogs).mockResolvedValue(logsSearchResponse);
    vi.mocked(mockDatadogApi.logsApi.aggregateLogs).mockResolvedValue({ data: {} });
    vi.mocked(mockDatadogApi.eventsApi.listEvents).mockResolvedValue(eventsSearchResponse);
    vi.mocked(mockDatadogApi.eventsApi.getEvent).mockResolvedValue({ event: { id: 1 } });
    vi.mocked(mockDatadogApi.monitorsApi.listMonitors).mockResolvedValue(monitorsListResponse);
    vi.mocked(mockDatadogApi.monitorsApi.getMonitor).mockResolvedValue(monitorsListResponse[0]);
    vi.mocked(mockDatadogApi.monitorsApi.searchMonitors).mockResolvedValue({
      monitors: monitorsListResponse,
      count: monitorsListResponse.length,
    });
    vi.mocked(mockDatadogApi.spansApi.listSpansGet).mockResolvedValue({
      data: tracesQueryResponse.data,
    });

    const metricsClient = new MetricsClient(config);
    const logsClient = new LogsClient(config);
    const eventsClient = new EventsClient(config);
    const monitorsClient = new MonitorsClient(config);
    const apmClient = new ApmClient(config);

    metricsTools = getMetricsTools(metricsClient);
    logsTools = getLogsTools(logsClient);
    eventsTools = getEventsTools(eventsClient);
    monitorsTools = getMonitorsTools(monitorsClient);
    apmTools = getApmTools(apmClient);
  });

  it("measures handler duration (baseline for in-process + mock)", async () => {
    const cases = [
      {
        name: "query_metrics",
        tool: metricsTools.find((t) => t.name === "query_metrics"),
        input: {
          metricName: "system.cpu",
          from: timestamps.from,
          to: timestamps.to,
        },
      },
      {
        name: "search_logs",
        tool: logsTools.find((t) => t.name === "search_logs"),
        input: {
          filter: "service:api",
          from: timestamps.fromMs,
          to: timestamps.toMs,
        },
      },
      {
        name: "search_events",
        tool: eventsTools.find((t) => t.name === "search_events"),
        input: {
          query: "priority:high",
          from: timestamps.from,
          to: timestamps.to,
        },
      },
      {
        name: "list_monitors",
        tool: monitorsTools.find((t) => t.name === "list_monitors"),
        input: {},
      },
      {
        name: "query_traces",
        tool: apmTools.find((t) => t.name === "query_traces"),
        input: {
          filter: "env:prod",
          from: timestamps.fromMs,
          to: timestamps.toMs,
          serviceName: "api",
        },
      },
    ];

    const results = [];

    for (const { name, tool, input } of cases) {
      const durations = [];
      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        await tool.handler(input);
        durations.push(performance.now() - start);
      }
      durations.sort((a, b) => a - b);
      const mean = durations.reduce((s, d) => s + d, 0) / durations.length;
      const p50 = percentile(durations, 50);
      const p99 = percentile(durations, 99);
      results.push({ name, mean, p50, p99 });
    }

    // Log structured baseline (stderr so it appears in test run)
    const summary = {
      message: "tool_handler_baseline",
      iterations: ITERATIONS,
      unit: "ms",
      tools: results,
    };
    console.error(JSON.stringify(summary));

    // Sanity: in-process + mock should be well under 100ms per call
    for (const r of results) {
      expect(r.mean).toBeLessThan(100);
    }
  });
});
