import { client, v1 } from "@datadog/datadog-api-client";
import { DatadogClientError } from "../utils/errors.js";

/**
 * Datadog Metrics API client using official Datadog SDK
 */
export class MetricsClient {
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
  }

  /**
   * Query metrics data from Datadog.
   * @param {string} query - The metrics query (e.g., "avg:system.cpu{*}")
   * @param {number} from - Unix timestamp (seconds) for start time
   * @param {number} to - Unix timestamp (seconds) for end time
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async queryMetrics(query, from, to) {
    try {
      if (!query) {
        return {
          data: null,
          error: new DatadogClientError("Query parameter is required"),
        };
      }

      if (from >= to) {
        return {
          data: null,
          error: new DatadogClientError("Start time must be before end time"),
        };
      }

      const result = await this.metricsApi.queryMetrics({
        from: Math.floor(from),
        to: Math.floor(to),
        query,
      });

      return { data: result, error: null };
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      return {
        data: null,
        error: new DatadogClientError(`HTTP ${statusCode}: ${error.message}`, statusCode, error),
      };
    }
  }

  /**
   * Get metadata about a specific metric.
   * @param {string} metricName - The metric name (e.g., "system.cpu")
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async getMetricMetadata(metricName) {
    try {
      if (!metricName) {
        return {
          data: null,
          error: new DatadogClientError("Metric name is required"),
        };
      }

      const result = await this.metricsApi.getMetricMetadata({ metricName });
      return { data: result, error: null };
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      return {
        data: null,
        error: new DatadogClientError(`HTTP ${statusCode}: ${error.message}`, statusCode, error),
      };
    }
  }

  /**
   * List metrics matching the specified query.
   * @param {string} query - Query string to filter metrics
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async listMetrics(query = "") {
    try {
      const params = {
        q: query || "*",
      };

      const result = await this.metricsApi.listMetrics(params);
      return { data: result, error: null };
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      return {
        data: null,
        error: new DatadogClientError(`HTTP ${statusCode}: ${error.message}`, statusCode, error),
      };
    }
  }

  /**
   * Validate a metrics query for syntax errors.
   * @param {string} query - The metrics query to validate
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async validateQuery(query) {
    try {
      if (!query) {
        return {
          data: null,
          error: new DatadogClientError("Query parameter is required"),
        };
      }

      // Note: SDK doesn't have a direct validate endpoint, perform a test query instead
      const now = Math.floor(Date.now() / 1000);
      const result = await this.metricsApi.queryMetrics({
        from: now - 60,
        to: now,
        query,
      });

      return { data: { valid: true, result }, error: null };
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      return {
        data: null,
        error: new DatadogClientError(`HTTP ${statusCode}: ${error.message}`, statusCode, error),
      };
    }
  }
}
