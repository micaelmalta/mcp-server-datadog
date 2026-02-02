/**
 * Tests for Datadog APM/Traces API client.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ApmClient } from "#clients/apmClient.js";
import { DatadogClientError } from "#utils/errors.js";
import {
  mockSuccess,
  mockError,
  clearMocks,
  createMockConfig,
  createTestTimestamps,
  assertValidResponse,
  getLastFetchCall,
} from "#test/helpers.js";
import {
  tracesQueryResponse,
  serviceHealthResponse,
  serviceDependenciesResponse,
} from "#test/fixtures/datadogResponses.js";

describe("ApmClient", () => {
  let client;
  let timestamps;

  beforeEach(() => {
    clearMocks();
    client = new ApmClient(createMockConfig());
    timestamps = createTestTimestamps();
  });

  describe("queryTraces", () => {
    it("should query traces successfully", async () => {
      mockSuccess(tracesQueryResponse);

      const { data, error } = await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should include filter in request", async () => {
      mockSuccess(tracesQueryResponse);

      await client.queryTraces(
        "service:api status:error",
        timestamps.fromMs,
        timestamps.toMs
      );

      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.filter.query).toBe("service:api status:error");
    });

    it("should handle empty filter", async () => {
      mockSuccess(tracesQueryResponse);

      const { data, error } = await client.queryTraces(
        "",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.filter.query).toBe("");
    });

    it("should use default page size of 10", async () => {
      mockSuccess(tracesQueryResponse);

      await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.options.page_size).toBe(10);
    });

    it("should support custom page size", async () => {
      mockSuccess(tracesQueryResponse);

      await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        { pageSize: 50 }
      );

      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.options.page_size).toBe(50);
    });

    it("should enforce maximum page size of 100", async () => {
      mockSuccess(tracesQueryResponse);

      await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        { pageSize: 200 }
      );

      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.options.page_size).toBe(100);
    });

    it("should use default sort of timestamp", async () => {
      mockSuccess(tracesQueryResponse);

      await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.options.sort).toBe("timestamp");
    });

    it("should support custom sort field", async () => {
      mockSuccess(tracesQueryResponse);

      await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        { sortBy: "duration" }
      );

      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.options.sort).toBe("duration");
    });

    it("should reject when from >= to", async () => {
      const { data, error } = await client.queryTraces(
        "service:api",
        timestamps.toMs,
        timestamps.fromMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Start time must be before end time");
    });

    it("should reject when from equals to", async () => {
      const { data, error } = await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.fromMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Start time must be before end time");
    });

    it("should floor timestamps", async () => {
      mockSuccess(tracesQueryResponse);
      const fromFloat = timestamps.fromMs + 0.5;
      const toFloat = timestamps.toMs + 0.7;

      await client.queryTraces("service:api", fromFloat, toFloat);

      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.filter.from).toBe(Math.floor(fromFloat));
      expect(body.filter.to).toBe(Math.floor(toFloat));
    });

    it("should handle API errors", async () => {
      mockError({ status: 401, message: "Unauthorized" });

      const { data, error } = await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(401);
    });

    it("should handle multiple traces in response", async () => {
      mockSuccess(tracesQueryResponse);

      const { data } = await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      expect(data.data.length).toBeGreaterThan(1);
    });
  });

  describe("getServiceHealth", () => {
    it("should get service health successfully", async () => {
      mockSuccess(serviceHealthResponse);

      const { data, error } = await client.getServiceHealth(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
      expect(data.service).toBe("api");
      expect(data.health).toBeDefined();
    });

    it("should reject empty service name", async () => {
      const { data, error } = await client.getServiceHealth(
        "",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Service name is required");
    });

    it("should reject null service name", async () => {
      const { data, error } = await client.getServiceHealth(
        null,
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Service name is required");
    });

    it("should include service name in request", async () => {
      mockSuccess(serviceHealthResponse);

      await client.getServiceHealth(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      const [url] = getLastFetchCall();
      expect(url).toContain("service=api");
    });

    it("should reject when from >= to", async () => {
      const { data, error } = await client.getServiceHealth(
        "api",
        timestamps.toMs,
        timestamps.fromMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Start time must be before end time");
    });

    it("should handle API errors", async () => {
      mockError({ status: 404, message: "Not Found" });

      const { data, error } = await client.getServiceHealth(
        "nonexistent",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(404);
    });

    it("should return health metrics", async () => {
      mockSuccess(serviceHealthResponse);

      const { data } = await client.getServiceHealth(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      expect(data.health.status).toBeDefined();
      expect(data.health.error_rate).toBeDefined();
      expect(data.health.p99_latency).toBeDefined();
    });

    it("should handle services with hyphens in name", async () => {
      mockSuccess(serviceHealthResponse);

      const { data, error } = await client.getServiceHealth(
        "api-gateway",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
    });
  });

  describe("getServiceDependencies", () => {
    it("should get service dependencies successfully", async () => {
      mockSuccess(serviceDependenciesResponse);

      const { data, error } = await client.getServiceDependencies(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
      expect(data.service).toBe("api");
      expect(data.direct_dependencies).toBeDefined();
    });

    it("should reject empty service name", async () => {
      const { data, error } = await client.getServiceDependencies(
        "",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Service name is required");
    });

    it("should reject null service name", async () => {
      const { data, error } = await client.getServiceDependencies(
        null,
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Service name is required");
    });

    it("should include service name in request", async () => {
      mockSuccess(serviceDependenciesResponse);

      await client.getServiceDependencies(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      const [url] = getLastFetchCall();
      expect(url).toContain("service=api");
    });

    it("should reject when from >= to", async () => {
      const { data, error } = await client.getServiceDependencies(
        "api",
        timestamps.toMs,
        timestamps.fromMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Start time must be before end time");
    });

    it("should handle API errors", async () => {
      mockError({ status: 403, message: "Forbidden" });

      const { data, error } = await client.getServiceDependencies(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(403);
    });

    it("should return dependency list", async () => {
      mockSuccess(serviceDependenciesResponse);

      const { data } = await client.getServiceDependencies(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      expect(Array.isArray(data.direct_dependencies)).toBe(true);
      expect(data.direct_dependencies.length).toBeGreaterThan(0);
    });

    it("should return downstream services", async () => {
      mockSuccess(serviceDependenciesResponse);

      const { data } = await client.getServiceDependencies(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      expect(Array.isArray(data.downstream_services)).toBe(true);
    });
  });

  describe("getServiceErrors", () => {
    it("should get service errors successfully", async () => {
      mockSuccess({
        service: "api",
        errors: [
          {
            type: "RuntimeError",
            count: 42,
            last_occurrence: 1609459200000,
          },
        ],
      });

      const { data, error } = await client.getServiceErrors(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
      expect(data.service).toBe("api");
      expect(data.errors).toBeDefined();
    });

    it("should reject empty service name", async () => {
      const { data, error } = await client.getServiceErrors(
        "",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Service name is required");
    });

    it("should reject null service name", async () => {
      const { data, error } = await client.getServiceErrors(
        null,
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Service name is required");
    });

    it("should reject when from >= to", async () => {
      const { data, error } = await client.getServiceErrors(
        "api",
        timestamps.toMs,
        timestamps.fromMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Start time must be before end time");
    });

    it("should handle API errors", async () => {
      mockError({ status: 500, message: "Internal Server Error" });

      const { data, error } = await client.getServiceErrors(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(500);
    });
  });

  describe("listServices", () => {
    it("should list services successfully", async () => {
      mockSuccess({
        data: [
          { name: "api", status: "healthy" },
          { name: "database", status: "healthy" },
          { name: "cache", status: "degraded" },
        ],
      });

      const { data, error } = await client.listServices();

      assertValidResponse({ data, error }, false);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("should handle empty service list", async () => {
      mockSuccess({ data: [] });

      const { data, error } = await client.listServices();

      assertValidResponse({ data, error }, false);
      expect(data.data).toHaveLength(0);
    });

    it("should handle API errors", async () => {
      mockError({ status: 401, message: "Unauthorized" });

      const { data, error } = await client.listServices();

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(401);
    });
  });

  describe("getServiceResources", () => {
    it("should get service resources successfully", async () => {
      mockSuccess({
        service: "api",
        resources: [
          {
            name: "GET /api/users",
            latency_ms: { p50: 45, p99: 125 },
            error_rate: 0.002,
          },
        ],
      });

      const { data, error } = await client.getServiceResources(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
      expect(data.resources).toBeDefined();
    });

    it("should reject empty service name", async () => {
      const { data, error } = await client.getServiceResources(
        "",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Service name is required");
    });

    it("should reject null service name", async () => {
      const { data, error } = await client.getServiceResources(
        null,
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Service name is required");
    });

    it("should reject when from >= to", async () => {
      const { data, error } = await client.getServiceResources(
        "api",
        timestamps.toMs,
        timestamps.fromMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Start time must be before end time");
    });

    it("should handle API errors", async () => {
      mockError({ status: 404, message: "Not Found" });

      const { data, error } = await client.getServiceResources(
        "nonexistent",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(404);
    });
  });

  describe("API integration", () => {
    it("should use v2 API base URL", () => {
      expect(client.client.baseUrl).toBe("https://api.datadoghq.com/api/v2");
    });

    it("should include DD-API-KEY header", async () => {
      mockSuccess(tracesQueryResponse);

      await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      const [, options] = getLastFetchCall();
      expect(options.headers["DD-API-KEY"]).toBe(createMockConfig().apiKey);
    });

    it("should include DD-APPLICATION-KEY header", async () => {
      mockSuccess(tracesQueryResponse);

      await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      const [, options] = getLastFetchCall();
      expect(options.headers["DD-APPLICATION-KEY"]).toBe(
        createMockConfig().appKey
      );
    });

    it("should support custom site domain", () => {
      const customClient = new ApmClient({
        ...createMockConfig(),
        site: "datadoghq.eu",
      });

      expect(customClient.client.baseUrl).toBe("https://api.datadoghq.eu/api/v2");
    });

    it("should use POST method for traces query", async () => {
      mockSuccess(tracesQueryResponse);

      await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      const [, options] = getLastFetchCall();
      expect(options.method).toBe("POST");
    });

    it("should use GET method for health queries", async () => {
      mockSuccess(serviceHealthResponse);

      await client.getServiceHealth(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      const [, options] = getLastFetchCall();
      expect(options.method).toBe("GET");
    });
  });

  describe("error handling", () => {
    it("should handle 401 unauthorized", async () => {
      mockError({ status: 401, message: "Unauthorized" });

      const { data, error } = await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      expect(error.statusCode).toBe(401);
    });

    it("should handle 403 forbidden", async () => {
      mockError({ status: 403, message: "Forbidden" });

      const { data, error } = await client.getServiceHealth(
        "api",
        timestamps.fromMs,
        timestamps.toMs
      );

      expect(error.statusCode).toBe(403);
    });

    it("should handle 429 rate limit", async () => {
      mockError({
        status: 429,
        message: "Too Many Requests",
      });

      const { data, error } = await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      expect(error.statusCode).toBe(429);
    });

    it("should handle 500 server error", async () => {
      mockError({ status: 500, message: "Internal Server Error" });

      const { data, error } = await client.listServices();

      expect(error.statusCode).toBe(500);
    });

    it("should preserve error details", async () => {
      mockError({
        status: 400,
        message: "Bad Request",
        errorData: { errors: ["Invalid filter"] },
      });

      const { data, error } = await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs
      );

      expect(error.originalError).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle service names with special characters", async () => {
      mockSuccess(serviceHealthResponse);

      const { data, error } = await client.getServiceHealth(
        "api-gateway-v2",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
    });

    it("should handle very large page size", async () => {
      mockSuccess(tracesQueryResponse);

      await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        { pageSize: 1000 }
      );

      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.options.page_size).toBe(100); // Should be capped
    });

    it("should handle very small page size", async () => {
      mockSuccess(tracesQueryResponse);

      await client.queryTraces(
        "service:api",
        timestamps.fromMs,
        timestamps.toMs,
        { pageSize: 1 }
      );

      const [, options] = getLastFetchCall();
      const body = JSON.parse(options.body);
      expect(body.options.page_size).toBe(1);
    });

    it("should handle complex filter queries", async () => {
      mockSuccess(tracesQueryResponse);
      const complexFilter =
        'service:api AND status:error AND (priority:high OR priority:critical)';

      const { data, error } = await client.queryTraces(
        complexFilter,
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
    });

    it("should handle unicode in service names", async () => {
      mockSuccess(serviceHealthResponse);

      const { data, error } = await client.getServiceHealth(
        "服务-api",
        timestamps.fromMs,
        timestamps.toMs
      );

      assertValidResponse({ data, error }, false);
    });

    it("should handle very large timestamp values", async () => {
      mockSuccess(tracesQueryResponse);
      const year2030From = 1893456000000; // 2030-01-01 in ms
      const year2030To = 1893542400000; // 2030-01-02 in ms

      const { data, error } = await client.queryTraces(
        "service:api",
        year2030From,
        year2030To
      );

      assertValidResponse({ data, error }, false);
    });
  });
});
