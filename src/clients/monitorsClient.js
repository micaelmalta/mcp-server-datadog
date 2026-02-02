import { client, v1 } from "@datadog/datadog-api-client";
import { DatadogClientError } from "../utils/errors.js";

/**
 * Datadog Monitors API client using official Datadog SDK
 */
export class MonitorsClient {
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

    this.monitorsApi = new v1.MonitorsApi(configuration);
  }

  /**
   * List all monitors with optional filters.
   * @param {Object} filters - Optional filters
   * @param {string} filters.name - Filter by monitor name
   * @param {string[]} filters.tags - Filter by tags
   * @param {string} filters.monitorType - Filter by monitor type
   * @param {string} filters.status - Filter by status
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async listMonitors(filters = {}) {
    try {
      const params = {};

      if (filters.name) {
        params.name = filters.name;
      }

      if (filters.tags && Array.isArray(filters.tags)) {
        params.tags = filters.tags.join(",");
      }

      if (filters.monitorType) {
        params.monitorTags = filters.monitorType;
      }

      const result = await this.monitorsApi.listMonitors(params);
      return { data: result, error: null };
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      return {
        data: null,
        error: new DatadogClientError(
          `HTTP ${statusCode}: ${error.message}`,
          statusCode,
          error
        ),
      };
    }
  }

  /**
   * Get detailed status information for a specific monitor.
   * @param {number} monitorId - The monitor ID
   * @param {Object} options - Optional parameters
   * @param {number} options.from - Unix timestamp (seconds) for start time
   * @param {number} options.to - Unix timestamp (seconds) for end time
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async getMonitorStatus(monitorId, _options = {}) {
    try {
      if (!monitorId && monitorId !== 0) {
        return {
          data: null,
          error: new DatadogClientError("Monitor ID is required"),
        };
      }

      const result = await this.monitorsApi.getMonitor({ monitorId });
      return { data: result, error: null };
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      return {
        data: null,
        error: new DatadogClientError(
          `HTTP ${statusCode}: ${error.message}`,
          statusCode,
          error
        ),
      };
    }
  }

  /**
   * Get downtime information for a monitor.
   * @param {number} monitorId - The monitor ID
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async getMonitorDowntime(monitorId) {
    try {
      if (!monitorId && monitorId !== 0) {
        return {
          data: null,
          error: new DatadogClientError("Monitor ID is required"),
        };
      }

      const result = await this.monitorsApi.getMonitor({ monitorId });
      return { data: result, error: null };
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      return {
        data: null,
        error: new DatadogClientError(
          `HTTP ${statusCode}: ${error.message}`,
          statusCode,
          error
        ),
      };
    }
  }

  /**
   * Search for monitors by name or tags.
   * @param {string} query - Search query string
   * @param {Object} options - Optional parameters
   * @param {number} options.pageSize - Number of results (default: 10)
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async searchMonitors(query, _options = {}) {
    try {
      if (!query) {
        return {
          data: null,
          error: new DatadogClientError("Search query is required"),
        };
      }

      const result = await this.monitorsApi.searchMonitors({
        query,
      });

      return { data: result, error: null };
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      return {
        data: null,
        error: new DatadogClientError(
          `HTTP ${statusCode}: ${error.message}`,
          statusCode,
          error
        ),
      };
    }
  }

  /**
   * Get a specific monitor by ID.
   * @param {number} monitorId - The monitor ID
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async getMonitor(monitorId) {
    try {
      if (!monitorId && monitorId !== 0) {
        return {
          data: null,
          error: new DatadogClientError("Monitor ID is required"),
        };
      }

      const result = await this.monitorsApi.getMonitor({ monitorId });
      return { data: result, error: null };
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      return {
        data: null,
        error: new DatadogClientError(
          `HTTP ${statusCode}: ${error.message}`,
          statusCode,
          error
        ),
      };
    }
  }

  /**
   * Get groups for a monitor (hosts, service instances, etc.).
   * @param {number} monitorId - The monitor ID
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async getMonitorGroups(monitorId) {
    try {
      if (monitorId !== 0 && (monitorId == null || monitorId === "")) {
        return {
          data: null,
          error: new DatadogClientError("Monitor ID is required"),
        };
      }

      const id = Number(monitorId);
      if (!Number.isFinite(id) || id < 0) {
        return {
          data: null,
          error: new DatadogClientError("Monitor ID must be a non-negative number"),
        };
      }

      // Search for monitor groups - SDK uses query parameter
      const result = await this.monitorsApi.searchMonitorGroups({
        query: `monitor_id:${id}`,
      });

      return { data: result, error: null };
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      return {
        data: null,
        error: new DatadogClientError(
          `HTTP ${statusCode}: ${error.message}`,
          statusCode,
          error
        ),
      };
    }
  }
}
