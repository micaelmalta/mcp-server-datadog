import { client, v2 } from "@datadog/datadog-api-client";
import { DatadogClientError } from "../utils/errors.js";
import { Logger } from "../utils/logger.js";

/**
 * Datadog Logs API client using official Datadog SDK
 */
export class LogsClient {
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

    this.logsApi = new v2.LogsApi(configuration);
  }

  /**
   * Search logs with filters and time range.
   * @param {string} filter - Log filter query (e.g., "service:api status:error")
   * @param {number} from - Unix timestamp (milliseconds) for start time
   * @param {number} to - Unix timestamp (milliseconds) for end time
   * @param {number} pageSize - Number of logs per page (default: 10, max: 100)
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async searchLogs(filter = "", from, to, pageSize = 10) {
    try {
      Logger.log("LogsClient", "searchLogs called", {
        filter,
        pageSize,
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      });

      if (from >= to) {
        Logger.log("LogsClient", "Invalid time range", { from, to });
        return {
          data: null,
          error: new DatadogClientError("Start time must be before end time"),
        };
      }

      if (pageSize < 1 || pageSize > 100) {
        return {
          data: null,
          error: new DatadogClientError("Page size must be between 1 and 100"),
        };
      }

      const body = {
        filter: {
          from: new Date(Math.floor(from)).toISOString(),
          to: new Date(Math.floor(to)).toISOString(),
          query: filter,
        },
        page: {
          limit: pageSize,
        },
        sort: /** @type {any} */ ("timestamp"),
      };

      Logger.log("LogsClient", "Calling listLogs API", { bodyFilter: body.filter });
      const result = await this.logsApi.listLogs({ body });
      Logger.log("LogsClient", "listLogs response", { logsCount: result?.data?.length || 0 });

      return { data: result, error: null };
    } catch (error) {
      Logger.error("LogsClient", "searchLogs error", error);
      return {
        data: null,
        error: new DatadogClientError(
          `HTTP ${error.statusCode || 500}: ${error.message}`,
          error.statusCode || 500,
          error
        ),
      };
    }
  }

  /**
   * Get detailed information about a specific log entry.
   * @param {string} logId - The unique ID of the log entry
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async getLogDetails(logId) {
    try {
      if (!logId || typeof logId !== "string") {
        return {
          data: null,
          error: new DatadogClientError("Log ID is required"),
        };
      }

      // Validate log ID format to prevent query injection (alphanumeric, hyphen, underscore)
      const logIdStr = String(logId).trim();
      if (!logIdStr || logIdStr.length > 512 || !/^[a-zA-Z0-9_-]+$/.test(logIdStr)) {
        return {
          data: null,
          error: new DatadogClientError(
            "Invalid log ID format: use only letters, numbers, hyphens, and underscores"
          ),
        };
      }

      // Search for the specific log by ID
      const body = {
        filter: {
          query: `@_id:${logIdStr}`,
        },
        page: {
          limit: 1,
        },
      };

      const result = await this.logsApi.listLogs({ body });
      const firstLog = result?.data?.[0] ?? null;
      return { data: firstLog, error: null };
    } catch (error) {
      return {
        data: null,
        error: new DatadogClientError(
          `HTTP ${error.statusCode || 500}: ${error.message}`,
          error.statusCode || 500,
          error
        ),
      };
    }
  }

  /**
   * Aggregate log data based on filters and time range.
   * @param {string} filter - Log filter query
   * @param {number} from - Unix timestamp (milliseconds) for start time
   * @param {number} to - Unix timestamp (milliseconds) for end time
   * @param {string} aggregationType - Type of aggregation (e.g., "avg", "max",
   *   "min", "sum", "cardinality")
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async aggregateLogs(filter = "", from, to, aggregationType) {
    try {
      Logger.log("LogsClient", "aggregateLogs called", { filter, aggregationType });

      if (from >= to) {
        return {
          data: null,
          error: new DatadogClientError("Start time must be before end time"),
        };
      }

      if (!aggregationType) {
        return {
          data: null,
          error: new DatadogClientError("Aggregation type is required"),
        };
      }

      const validTypes = ["avg", "max", "min", "sum", "cardinality"];
      if (!validTypes.includes(aggregationType)) {
        return {
          data: null,
          error: new DatadogClientError(
            `Invalid aggregation type. Must be one of: ${validTypes.join(", ")}`
          ),
        };
      }

      const body = {
        filter: {
          from: new Date(Math.floor(from)).toISOString(),
          to: new Date(Math.floor(to)).toISOString(),
          query: filter,
        },
        compute: [
          {
            aggregation: /** @type {any} */ (aggregationType),
            metric: "@timestamp",
          },
        ],
      };

      Logger.log("LogsClient", "Calling aggregateLogs API", { bodyFilter: body.filter });
      const result = await this.logsApi.aggregateLogs({ body });
      Logger.log("LogsClient", "aggregateLogs response received", { hasData: !!result });

      return { data: result, error: null };
    } catch (error) {
      Logger.error("LogsClient", "aggregateLogs error", error);
      return {
        data: null,
        error: new DatadogClientError(
          `HTTP ${error.statusCode || 500}: ${error.message}`,
          error.statusCode || 500,
          error
        ),
      };
    }
  }

  /**
   * List all available log indexes.
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async listIndexes() {
    try {
      // Note: Use LogsIndexesApi from v1 for index management
      const v1 = require("@datadog/datadog-api-client").v1;
      const configuration = client.createConfiguration({
        authMethods: {
          apiKeyAuth: this.apiKey,
          appKeyAuth: this.appKey,
        },
      });
      configuration.setServerVariables({ site: this.site });
      const indexesApi = new v1.LogsIndexesApi(configuration);

      const result = await indexesApi.listLogIndexes();
      return { data: result, error: null };
    } catch (error) {
      return {
        data: null,
        error: new DatadogClientError(
          `HTTP ${error.statusCode || 500}: ${error.message}`,
          error.statusCode || 500,
          error
        ),
      };
    }
  }
}
