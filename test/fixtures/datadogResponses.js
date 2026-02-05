/**
 * Mock Datadog API responses for testing purposes.
 */

/**
 * Sample metric query response
 */
export const metricsQueryResponse = {
  status: "ok",
  query: "avg:system.cpu{*}",
  from_date: 1609459200,
  to_date: 1609545600,
  res_type: "time_series",
  series: [
    {
      pointlist: [
        [1609459200000, 45.2],
        [1609462800000, 48.5],
        [1609466400000, 52.1],
      ],
      start: 1609459200,
      end: 1609545600,
      interval: 3600,
      length: 24,
      metric: "system.cpu",
      expression: "avg:system.cpu{*}",
      scope: "host:web-01",
      tags: ["env:prod", "service:api"],
    },
  ],
};

/**
 * Sample metric metadata response
 */
export const metricMetadataResponse = {
  type: "gauge",
  description: "Average CPU usage across all hosts",
  integration: "system",
  short_name: "system.cpu",
  statsd_interval: null,
  unit: "percent",
  per_unit_details: {
    human_readable: "percent",
    short_name: "%",
  },
  metadata: {
    origin: "check_run",
    unit: null,
  },
  created_date: null,
  last_modified: 1609459200,
  expression: "avg:system.cpu{*}",
};

/**
 * Sample logs search response
 */
export const logsSearchResponse = {
  data: [
    {
      id: "AXvj0ZDn5d08oxCb7t9q",
      type: "logs",
      attributes: {
        timestamp: 1609459200000,
        service: "api",
        host: "web-01",
        status: "error",
        message: "Failed to process request",
        http: {
          method: "POST",
          status_code: 500,
          url: "https://api.example.com/v1/users",
        },
        attributes: {
          user_id: "12345",
          request_id: "req-abc-123",
        },
      },
    },
    {
      id: "AXvj0ZDn5d08oxCb7t9r",
      type: "logs",
      attributes: {
        timestamp: 1609462800000,
        service: "api",
        host: "web-02",
        status: "info",
        message: "Request processed successfully",
        http: {
          method: "GET",
          status_code: 200,
          url: "https://api.example.com/v1/health",
        },
      },
    },
  ],
  links: {
    next: "https://api.datadoghq.com/api/v2/logs/events/search?page[after]=page-token-123",
  },
  meta: {
    page: {
      after: "page-token-123",
    },
  },
};

/**
 * Sample events search response
 */
export const eventsSearchResponse = {
  status: "ok",
  events: [
    {
      id: 12345678,
      date_happened: 1609459200,
      handle: "user@example.com",
      alert_transition: "triggered",
      title: "Monitor Alert: High CPU on web-01",
      priority: "normal",
      last_updated: 1609462800,
      text: "CPU usage exceeded 90% threshold",
      tags: ["service:api", "env:prod", "priority:high"],
      resource: "monitor",
      alert_type: "error",
    },
    {
      id: 12345679,
      date_happened: 1609466400,
      handle: "devops@example.com",
      alert_transition: "recovered",
      title: "Monitor Alert: High CPU on web-01 - RECOVERED",
      priority: "low",
      last_updated: 1609470000,
      text: "CPU usage returned to normal",
      tags: ["service:api", "env:prod"],
      resource: "monitor",
      alert_type: "success",
    },
  ],
};

/**
 * Sample monitors list response
 */
export const monitorsListResponse = [
  {
    id: 1234567,
    name: "High CPU Usage",
    type: "metric alert",
    query: "avg(last_5m):avg:system.cpu{service:api} > 0.9",
    message: "CPU usage is critically high on {{host.name}}",
    tags: ["service:api", "env:prod"],
    options: {
      thresholds: {
        critical: 0.9,
        warning: 0.7,
      },
      notify_no_data: true,
      no_data_timeframe: 10,
    },
    org_id: 1,
    created: "2021-01-01T00:00:00.000Z",
    created_by: {
      id: 1,
      handle: "devops@example.com",
      name: "DevOps Team",
      email: "devops@example.com",
    },
    deleted: null,
    modified: "2021-02-01T12:00:00.000Z",
    modified_by: {
      id: 1,
      handle: "devops@example.com",
      name: "DevOps Team",
      email: "devops@example.com",
    },
    overall_state: "OK",
    state: {
      groups: {
        "host:web-01": "OK",
        "host:web-02": "OK",
      },
    },
  },
  {
    id: 1234568,
    name: "High Memory Usage",
    type: "metric alert",
    query: "avg(last_5m):avg:system.mem.pct_usable{service:api} < 0.1",
    message: "Memory usage is critically high on {{host.name}}",
    tags: ["service:api", "env:prod"],
    options: {
      thresholds: {
        critical: 0.1,
        warning: 0.2,
      },
      notify_no_data: true,
    },
    overall_state: "ALERT",
    state: {
      groups: {
        "host:web-01": "ALERT",
        "host:web-02": "OK",
      },
    },
  },
];

/**
 * Sample monitor status response
 */
export const monitorStatusResponse = {
  id: 1234567,
  name: "High CPU Usage",
  overall_state: "OK",
  groups: {
    "host:web-01": {
      status: "OK",
      last_update: 1609459200,
      notifications: [],
    },
    "host:web-02": {
      status: "OK",
      last_update: 1609459200,
      notifications: [],
    },
  },
  state_updated_ts: 1609459200,
  created_ts: 1609459200,
  escalation: 0,
  last_nodata_ts: null,
  last_triggered_ts: 1609366800,
  org_id: 1,
};

/**
 * Sample APM traces response
 */
export const tracesQueryResponse = {
  data: [
    {
      trace_id: "1234567890abcdef",
      span_id: "fedcba0987654321",
      parent_id: null,
      service: "api",
      name: "POST /api/v1/users",
      resource: "POST",
      type: "web",
      start_time: 1609459200000,
      duration: 125000,
      status: "ok",
      http: {
        method: "POST",
        status_code: 201,
        url: "https://api.example.com/v1/users",
      },
      tags: ["env:prod", "version:1.0.0"],
    },
    {
      trace_id: "1234567890abcdef",
      span_id: "fedcba0987654322",
      parent_id: "fedcba0987654321",
      service: "database",
      name: "sql.query",
      resource: "INSERT INTO users",
      type: "sql",
      start_time: 1609459200050,
      duration: 45000,
      status: "ok",
      sql: {
        query: "INSERT INTO users (name, email) VALUES (?, ?)",
        rows_affected: 1,
      },
    },
  ],
};

/**
 * Sample service health response
 */
export const serviceHealthResponse = {
  service: "api",
  health: {
    status: "healthy",
    error_rate: 0.002,
    p99_latency: 125,
    throughput: 15000,
    apdex_score: 0.95,
  },
  metrics: {
    error_count: 30,
    request_count: 15000,
    latency_ms: {
      p50: 45,
      p90: 95,
      p99: 125,
    },
  },
  dependencies: ["database", "cache", "auth-service"],
};

/**
 * Sample service dependencies response
 */
export const serviceDependenciesResponse = {
  service: "api",
  direct_dependencies: [
    {
      service: "database",
      latency_ms: 25,
      error_rate: 0,
      throughput: 15000,
    },
    {
      service: "cache",
      latency_ms: 5,
      error_rate: 0.001,
      throughput: 10000,
    },
    {
      service: "auth-service",
      latency_ms: 50,
      error_rate: 0.005,
      throughput: 5000,
    },
  ],
  downstream_services: ["web-frontend", "mobile-app", "admin-dashboard"],
};

/**
 * Error response mock
 */
export const errorResponse = {
  errors: ["Invalid API key"],
  status: "error",
};

/**
 * Rate limit error response mock
 */
export const rateLimitErrorResponse = {
  errors: ["Rate limit exceeded"],
  status: "error",
};

/**
 * Validation error response mock
 */
export const validationErrorResponse = {
  errors: ["Invalid query syntax"],
  status: "error",
};
