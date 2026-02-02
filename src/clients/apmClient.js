import { client, v1, v2 } from "@datadog/datadog-api-client";
import { DatadogClientError } from "../utils/errors.js";

/**
 * Datadog APM/Traces API client using official Datadog SDK
 */
export class ApmClient {
  /**
   * @param {Object} config - Client configuration
   * @param {string} config.apiKey - Datadog API key
   * @param {string} config.appKey - Datadog app key
   * @param {string} config.site - Datadog site (default: datadoghq.com)
   */
  constructor(config) {
    this.apiKey = config.apiKey;
    this.appKey = config.appKey;
    this.site = config.site || "datadoghq.com";

    // Configure Datadog SDK
    const configuration = client.createConfiguration({
      authMethods: {
        apiKeyAuth: config.apiKey,
        appKeyAuth: config.appKey,
      },
    });
    configuration.setServerVariables({
      site: this.site,
    });

    this.metricsApi = new v1.MetricsApi(configuration);
    this.apmRetentionFiltersApi = new v2.APMRetentionFiltersApi(configuration);
    this.spansApi = new v2.SpansApi(configuration);
  }

  /**
   * Query APM traces: use Spans API when possible for real trace list; fallback to trace metrics.
   * @param {string} filter - Trace filter (e.g. "env:production")
   * @param {number} from - Unix timestamp (milliseconds)
   * @param {number} to - Unix timestamp (milliseconds)
   * @param {Object} options - Additional options (serviceName, pageSize)
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async queryTraces(filter = "", from, to, options = {}) {
    try {
      if (from >= to) {
        return {
          data: null,
          error: new DatadogClientError("Start time must be before end time"),
        };
      }

      const limit = Math.min(options.pageSize || 100, 100);
      const serviceName = options.serviceName;

      // Build span query: service:name and optional filter (e.g. env:production)
      const queryParts = [];
      if (serviceName) queryParts.push(`service:${serviceName}`);
      if (filter && filter.trim()) queryParts.push(filter.trim());
      const spanQuery = queryParts.length > 0 ? queryParts.join(" ") : undefined;

      // Try Spans API first for actual trace/span data; fall back to metrics on any error
      if (spanQuery) {
        try {
          const fromIso = new Date(from).toISOString();
          const toIso = new Date(to).toISOString();
          const response = await this.spansApi.listSpansGet({
            filterQuery: spanQuery,
            filterFrom: fromIso,
            filterTo: toIso,
            pageLimit: limit,
          });

          const spans = Array.isArray(response.data) ? response.data : [];
          const byTrace = {};
          for (const span of spans) {
            const attrs = span.attributes || span;
            const traceId =
              attrs.trace_id ?? attrs.traceId ?? span.trace_id ?? span.traceId;
            if (!traceId) continue;
            if (!byTrace[traceId]) {
              byTrace[traceId] = {
                trace_id: traceId,
                span_count: 0,
                duration: attrs.duration ?? span.duration,
                status: attrs.status ?? span.status,
                service: attrs.service ?? span.service,
                resource: attrs.resource ?? span.resource,
              };
            }
            byTrace[traceId].span_count += 1;
            if (attrs.duration != null && (byTrace[traceId].duration == null || attrs.duration > byTrace[traceId].duration)) {
              byTrace[traceId].duration = attrs.duration;
            }
          }

          const traces = Object.values(byTrace);
          return {
            data: {
              traces,
              tracesCount: traces.length,
              message: traces.length > 0 ? "Trace list from Spans API" : "No traces in range",
            },
            error: null,
          };
        } catch (_spanError) {
          // Fall back to trace metrics on any Spans API error (401, 403, 500, etc.)
          return this._queryTracesFallbackMetrics(filter, from, to, limit);
        }
      }

      return this._queryTracesFallbackMetrics(filter, from, to, limit);
    } catch (error) {
      return {
        data: null,
        error: new DatadogClientError(`HTTP ${error.statusCode || 500}: ${error.message}`),
      };
    }
  }

  /**
   * List unique endpoints (service + resource) from APM spans in a time window.
   * Resource is typically the HTTP path or operation name. Useful for exporting endpoint-level data.
   * @param {string} serviceName - Service to get endpoints for
   * @param {number} from - Unix timestamp (milliseconds)
   * @param {number} to - Unix timestamp (milliseconds)
   * @param {Object} options - Optional parameters
   * @param {string} [options.env] - Environment tag (e.g. "production")
   * @param {number} [options.pageLimit] - Max spans to scan (default 500)
   * @returns {Promise<{data: {endpoints: Array<{service: string, resource: string}>}, error: null} | {data: null, error: Error}>}
   */
  async listServiceEndpoints(serviceName, from, to, options = {}) {
    try {
      if (!serviceName || from >= to) {
        return {
          data: null,
          error: new DatadogClientError("Service name and valid time range required"),
        };
      }

      const queryParts = [`service:${serviceName}`];
      if (options.env) queryParts.push(`env:${options.env}`);
      const spanQuery = queryParts.join(" ");
      const limit = Math.min(options.pageLimit ?? 500, 1000);

      const fromIso = new Date(from).toISOString();
      const toIso = new Date(to).toISOString();
      const response = await this.spansApi.listSpansGet({
        filterQuery: spanQuery,
        filterFrom: fromIso,
        filterTo: toIso,
        pageLimit: limit,
      });

      const spans = Array.isArray(response.data) ? response.data : [];
      const seen = new Set();
      const endpoints = [];

      for (const span of spans) {
        const attrs = span.attributes || span;
        const svc = attrs.service ?? span.service ?? serviceName;
        // Spans API v2 uses resourceName; also support resource (trace view)
        const res =
          attrs.resourceName ?? attrs.resource ?? span.resourceName ?? span.resource;
        if (!res || typeof res !== "string") continue;
        const key = `${svc}\0${res}`;
        if (seen.has(key)) continue;
        seen.add(key);
        endpoints.push({ service: svc, resource: res });
      }

      return {
        data: { endpoints },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof DatadogClientError
            ? error
            : new DatadogClientError(`HTTP ${error.statusCode || 500}: ${error.message}`),
      };
    }
  }

  /**
   * Get span attribute helpers (supports attributes or top-level, camel or snake).
   * @private
   */
  static _spanAttr(span, key) {
    const attrs = span.attributes || span;
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    return attrs[key] ?? attrs[camel] ?? span[key] ?? span[camel];
  }

  /**
   * List inbound/outbound endpoint (service + resource) dependencies per endpoint from trace data.
   * Fetches spans for the service, then full traces by trace_id, and derives parent (inbound) and
   * child (outbound) endpoints per HTTP resource.
   * @param {string} serviceName - Service to get endpoint dependencies for
   * @param {number} from - Unix timestamp (milliseconds)
   * @param {number} to - Unix timestamp (milliseconds)
   * @param {Object} options - Optional parameters
   * @param {string} [options.env] - Environment tag (e.g. "production")
   * @param {number} [options.pageLimit] - Max spans to scan (default 200)
   * @param {number} [options.maxTraces] - Max traces to fetch fully (default 25)
   * @returns {Promise<{data: {byResource: Object<string, {inbound: Array<{service, resource}>, outbound: Array<{service, resource}>}>}, error: null} | {data: null, error: Error}>}
   */
  async listEndpointDependencies(serviceName, from, to, options = {}) {
    const HTTP_RESOURCE = /^(GET|POST|PUT|PATCH|DELETE)\s+\//i;
    try {
      if (!serviceName || from >= to) {
        return {
          data: null,
          error: new DatadogClientError("Service name and valid time range required"),
        };
      }

      const spanLimit = Math.min(options.pageLimit ?? 200, 500);
      const maxTraces = Math.min(options.maxTraces ?? 25, 50);
      const queryParts = [`service:${serviceName}`];
      if (options.env) queryParts.push(`env:${options.env}`);
      const spanQuery = queryParts.join(" ");
      const fromIso = new Date(from).toISOString();
      const toIso = new Date(to).toISOString();

      const listResp = await this.spansApi.listSpansGet({
        filterQuery: spanQuery,
        filterFrom: fromIso,
        filterTo: toIso,
        pageLimit: spanLimit,
      });
      const spans = Array.isArray(listResp.data) ? listResp.data : [];
      const traceIds = new Set();
      for (const s of spans) {
        const tid = ApmClient._spanAttr(s, "trace_id");
        if (tid) traceIds.add(String(tid));
      }
      const traceIdList = [...traceIds].slice(0, maxTraces);

      const byResource = {};
      const traceFilterVariants = (tid) => [`@trace_id:${tid}`, `trace_id:${tid}`];
      const delayMs = 600;
      for (let i = 0; i < traceIdList.length; i++) {
        const traceId = traceIdList[i];
        if (i > 0) await new Promise((r) => setTimeout(r, delayMs));
        let traceSpans = [];
        for (const traceFilter of traceFilterVariants(traceId)) {
          try {
            const traceResp = await this.spansApi.listSpansGet({
              filterQuery: traceFilter,
              filterFrom: fromIso,
              filterTo: toIso,
              pageLimit: 500,
            });
            traceSpans = Array.isArray(traceResp.data) ? traceResp.data : [];
            if (traceSpans.length > 0) break;
          } catch (_) {
            // try next variant
          }
        }
          const bySpanId = {};
          for (const s of traceSpans) {
            const sid = ApmClient._spanAttr(s, "span_id");
            if (sid) bySpanId[String(sid)] = s;
          }
          for (const s of traceSpans) {
            const svc = ApmClient._spanAttr(s, "service") || serviceName;
            const res =
              ApmClient._spanAttr(s, "resource_name") ??
              ApmClient._spanAttr(s, "resourceName") ??
              ApmClient._spanAttr(s, "resource");
            if (!res || typeof res !== "string") continue;
            const sid = ApmClient._spanAttr(s, "span_id");
            const pid = ApmClient._spanAttr(s, "parent_id");
            if (svc !== serviceName) continue;
            if (!HTTP_RESOURCE.test(res)) continue;
            if (!byResource[res]) byResource[res] = { inbound: [], outbound: [] };
            const seenIn = new Set();
            const seenOut = new Set();
            if (pid && bySpanId[String(pid)]) {
              const parent = bySpanId[String(pid)];
              const pSvc = ApmClient._spanAttr(parent, "service");
              const pRes =
                ApmClient._spanAttr(parent, "resource_name") ??
                ApmClient._spanAttr(parent, "resourceName") ??
                ApmClient._spanAttr(parent, "resource");
              if (pSvc && pRes && HTTP_RESOURCE.test(pRes)) {
                const key = `${pSvc}\0${pRes}`;
                if (!seenIn.has(key)) {
                  seenIn.add(key);
                  byResource[res].inbound.push({ service: pSvc, resource: pRes });
                }
              }
            }
            for (const other of traceSpans) {
              if (String(ApmClient._spanAttr(other, "parent_id")) === String(sid)) {
                const oSvc = ApmClient._spanAttr(other, "service");
                const oRes =
                  ApmClient._spanAttr(other, "resource_name") ??
                  ApmClient._spanAttr(other, "resourceName") ??
                  ApmClient._spanAttr(other, "resource");
                if (oSvc && oRes && HTTP_RESOURCE.test(oRes)) {
                  const key = `${oSvc}\0${oRes}`;
                  if (!seenOut.has(key)) {
                    seenOut.add(key);
                    byResource[res].outbound.push({ service: oSvc, resource: oRes });
                  }
                }
              }
            }
          }
      }

      for (const r of Object.keys(byResource)) {
        const uniq = (arr) => [...new Map(arr.map((x) => [`${x.service}\0${x.resource}`, x]).values()).values()];
        byResource[r].inbound = uniq(byResource[r].inbound);
        byResource[r].outbound = uniq(byResource[r].outbound);
      }

      return { data: { byResource }, error: null };
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof DatadogClientError
            ? error
            : new DatadogClientError(`HTTP ${error.statusCode || 500}: ${error.message}`),
      };
    }
  }

  /**
   * Fallback: query trace metrics when Spans API is not used or unavailable.
   * @private
   */
  async _queryTracesFallbackMetrics(filter, from, to, limit) {
    const fromSec = Math.floor(from / 1000);
    const toSec = Math.floor(to / 1000);
    const query = filter ? `trace.${filter.split(":")[0]}{${filter}}` : "trace.*";
    const result = await this.metricsApi.queryMetrics({
      from: fromSec,
      to: toSec,
      query,
    });
    const series = result.series || [];
    const traces = series.slice(0, limit).map((s) => ({
      trace_id: s.scope ?? `series-${s.tag_set?.join?.("-") ?? "unknown"}`,
      span_count: s.pointlist?.length ?? 0,
      scope: s.scope,
    }));
    return {
      data: {
        traces,
        tracesCount: traces.length,
        message: "Trace metrics available",
      },
      error: null,
    };
  }

  /**
   * Get service health metrics
   * @param {string} serviceName - Service name
   * @param {number} from - Unix timestamp (milliseconds)
   * @param {number} to - Unix timestamp (milliseconds)
   * @param {Object} options - Optional parameters
   * @param {string} options.env - Environment tag (e.g. production) to scope metrics
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async getServiceHealth(serviceName, from, to, options = {}) {
    try {
      if (!serviceName) {
        return {
          data: null,
          error: new DatadogClientError("Service name is required"),
        };
      }

      if (from >= to) {
        return {
          data: null,
          error: new DatadogClientError("Start time must be before end time"),
        };
      }

      const fromSec = Math.floor(from / 1000);
      const toSec = Math.floor(to / 1000);
      const filterParts = [`service:${serviceName}`];
      if (options.env) filterParts.push(`env:${options.env}`);
      const filter = filterParts.join(",");

      // Try multiple APM metric families: http (Go/Node), servlet (Java), rack (Ruby)
      // Use same query form as Metrics API (no .as_count()) so series are returned
      const requestQueries = [
        `trace.http.request.hits{${filter}}`,
        `trace.servlet.request.hits{${filter}}`,
        `trace.rack.request.hits{${filter}}`,
      ];
      const errorQueries = [
        `trace.http.request.errors{${filter}}`,
        `trace.servlet.request.errors{${filter}}`,
        `trace.rack.request.errors{${filter}}`,
      ];
      const latencyQueries = [
        `avg:trace.http.request.duration{${filter}}`,
        `avg:trace.servlet.request.duration{${filter}}`,
        `avg:trace.rack.request.duration{${filter}}`,
      ];

      const runQueries = (qList) =>
        Promise.all(
          qList.map((q) =>
            this.metricsApi.queryMetrics({ from: fromSec, to: toSec, query: q }).catch(() => ({ series: [] }))
          )
        );

      const [reqResults, errResults, latResults] = await Promise.all([
        runQueries(requestQueries),
        runQueries(errorQueries),
        runQueries(latencyQueries),
      ]);

      const mergeSeries = (arr) => arr.flatMap((r) => r.series || []);

      return {
        data: {
          service: serviceName,
          requests: mergeSeries(reqResults),
          errors: mergeSeries(errResults),
          latency: mergeSeries(latResults),
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: new DatadogClientError(`HTTP ${error.statusCode || 500}: ${error.message}`),
      };
    }
  }

  /**
   * Get service dependencies
   * @param {string} serviceName - Service name
   * @param {number} from - Unix timestamp (milliseconds)
   * @param {number} to - Unix timestamp (milliseconds)
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async getServiceDependencies(serviceName, from, to) {
    try {
      if (!serviceName) {
        return {
          data: null,
          error: new DatadogClientError("Service name is required"),
        };
      }

      // Note: SDK doesn't expose service dependencies directly
      // Return service info via metrics
      const fromSec = Math.floor(from / 1000);
      const toSec = Math.floor(to / 1000);

      const result = await this.metricsApi.queryMetrics({
        from: fromSec,
        to: toSec,
        query: `trace.*{service:${serviceName}}`,
      });

      return {
        data: {
          service: serviceName,
          dependencies: result.series || [],
          message: "Service metrics (dependencies require service map API)",
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: new DatadogClientError(`HTTP ${error.statusCode || 500}: ${error.message}`),
      };
    }
  }

  /**
   * List all available services (not directly available in SDK, using metrics)
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async listServices() {
    try {
      // Query for trace services via metrics
      const now = Math.floor(Date.now() / 1000);
      const oneHourAgo = now - 3600;

      const result = await this.metricsApi.queryMetrics({
        from: oneHourAgo,
        to: now,
        query: "trace.*",
      });

      // Extract unique services from metrics
      const services = new Set();
      (result.series || []).forEach((s) => {
        if (s.scope && s.scope.includes("service:")) {
          const match = s.scope.match(/service:([^,}]+)/);
          if (match) services.add(match[1]);
        }
      });

      return {
        data: Array.from(services).map((s) => ({ service: s })),
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: new DatadogClientError(`HTTP ${error.statusCode || 500}: ${error.message}`),
      };
    }
  }
}
