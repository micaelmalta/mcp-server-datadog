/**
 * Mock for @datadog/datadog-api-client used in client tests.
 * Clients use the SDK (MetricsApi, MonitorsApi, etc.) instead of fetch;
 * this mock provides controllable API instances so tests can set return values.
 */

import { vi } from "vitest";

const instances = vi.hoisted(() => ({
  metricsApi: {
    queryMetrics: vi.fn(),
    getMetricMetadata: vi.fn(),
    listMetrics: vi.fn(),
  },
  monitorsApi: {
    listMonitors: vi.fn(),
    getMonitor: vi.fn(),
    searchMonitors: vi.fn(),
    searchMonitorGroups: vi.fn(),
  },
  eventsApi: {
    listEvents: vi.fn(),
    getEvent: vi.fn(),
  },
  logsApi: {
    listLogs: vi.fn(),
    aggregateLogs: vi.fn(),
  },
  spansApi: {
    listSpansGet: vi.fn(),
  },
  apmRetentionFiltersApi: {},
}));

vi.mock("@datadog/datadog-api-client", () => ({
  client: {
    createConfiguration: vi.fn(() => ({
      setServerVariables: vi.fn(),
    })),
  },
  v1: {
    MetricsApi: vi.fn(() => instances.metricsApi),
    MonitorsApi: vi.fn(() => instances.monitorsApi),
    EventsApi: vi.fn(() => instances.eventsApi),
  },
  v2: {
    LogsApi: vi.fn(() => instances.logsApi),
    SpansApi: vi.fn(() => instances.spansApi),
    APMRetentionFiltersApi: vi.fn(() => instances.apmRetentionFiltersApi),
  },
}));

export const mockDatadogApi = instances;
