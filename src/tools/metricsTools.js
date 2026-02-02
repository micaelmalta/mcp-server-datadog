import { MetricsClient } from "../clients/metricsClient.js";

/**
 * Tool definitions and handlers for Datadog Metrics API.
 * Provides tools to query metrics, get metadata, and list available metrics.
 */

/**
 * Convert various time formats to Unix timestamp in seconds.
 * @param {number | string} time - Time value (Unix seconds, ISO 8601 string)
 * @returns {number} Unix timestamp in seconds
 * @private
 */
function parseTimestamp(time) {
  if (typeof time === "number") {
    return time;
  }

  if (typeof time === "string") {
    // Try ISO 8601 format
    const isoTime = new Date(time).getTime();
    if (!Number.isNaN(isoTime)) {
      return Math.floor(isoTime / 1000);
    }

    // Try Unix seconds
    const unixSeconds = parseInt(time, 10);
    if (!Number.isNaN(unixSeconds)) {
      return unixSeconds;
    }
  }

  throw new Error(`Invalid timestamp format: ${time}`);
}

/**
 * Query Metrics tool definition.
 * Retrieves metric data for a specified time range.
 * @type {Object}
 */
const queryMetricsTool = {
  name: "query_metrics",
  description:
    "Query Datadog metrics data for a specified time range. Returns " +
    "time-series data with values aggregated over the specified period.",
  inputSchema: {
    type: "object",
    properties: {
      metricName: {
        type: "string",
        description:
          'Metric name to query (e.g., "system.cpu.user", ' +
          '"avg:system.memory.free")',
      },
      from: {
        oneOf: [{ type: "number" }, { type: "string" }],
        description:
          "Start time as Unix timestamp in seconds or ISO 8601 string " +
          "(e.g., 1609459200 or '2021-01-01T00:00:00Z')",
      },
      to: {
        oneOf: [{ type: "number" }, { type: "string" }],
        description:
          "End time as Unix timestamp in seconds or ISO 8601 string " +
          "(must be after 'from')",
      },
      filter: {
        type: "string",
        description:
          "Optional filter expression to scope the metric " +
          "(e.g., 'host:web-1', 'env:prod')",
      },
    },
    required: ["metricName", "from", "to"],
  },
};

/**
 * Get Metric Metadata tool definition.
 * Retrieves metadata about a specific metric including units and tags.
 * @type {Object}
 */
const getMetricMetadataTool = {
  name: "get_metric_metadata",
  description:
    "Retrieve metadata about a Datadog metric including " +
    "units, description, tags, and integration information.",
  inputSchema: {
    type: "object",
    properties: {
      metricName: {
        type: "string",
        description: "Name of the metric to get metadata for",
      },
    },
    required: ["metricName"],
  },
};

/**
 * List Metrics tool definition.
 * Lists available metrics, optionally filtered by query.
 * @type {Object}
 */
const listMetricsTool = {
  name: "list_metrics",
  description:
    "List available Datadog metrics, optionally filtered by a search query. " +
    "Useful for discovering what metrics are available in your environment.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Search query to filter metrics (e.g., 'system', 'app.request'). " +
          "Partial matches are supported.",
      },
      limit: {
        type: "number",
        description: "Maximum number of metrics to return (default: 100, max: 1000)",
        default: 100,
      },
    },
  },
};

/**
 * Handle query_metrics tool request.
 * @param {Object} input - Tool input
 * @param {string} input.metricName - Metric name to query
 * @param {number | string} input.from - Start timestamp
 * @param {number | string} input.to - End timestamp
 * @param {string} [input.filter] - Optional filter expression
 * @param {MetricsClient} client - Metrics API client
 * @returns {Promise<Object>} Tool result with metric data or error
 */
async function handleQueryMetrics(input, client) {
  try {
    // Validate and parse timestamps
    const from = parseTimestamp(input.from);
    const to = parseTimestamp(input.to);

    if (from >= to) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: Start time (from) must be before end time (to)",
          },
        ],
      };
    }

    const metricName =
      typeof input.metricName === "string" ? input.metricName.trim() : "";
    if (!metricName) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: metricName must be a non-empty string",
          },
        ],
      };
    }

    // Sanitize filter: disallow characters that could break or inject into metric query
    const filter = input.filter && typeof input.filter === "string" ? input.filter : "";
    if (filter && (/[{}]/.test(filter))) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: filter must not contain { or } (invalid for metric query syntax)",
          },
        ],
      };
    }

    // Build the query
    let query = metricName;
    if (filter) {
      query = `${metricName}{${filter}}`;
    }

    // Query the metrics
    const { data, error } = await client.queryMetrics(query, from, to);

    if (error) {
      console.error("Metrics query error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error querying metrics: ${error.message}`,
          },
        ],
      };
    }

    // Limit data points in response
    const limitedData = {
      ...data,
      series: data.series?.slice(0, 50).map((s) => ({
        ...s,
        points: s.points?.slice(0, 100), // Limit points per series
      })),
    };

    return {
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            metric: metricName,
            filter: filter || "none",
            timeRange: {
              from: new Date(from * 1000).toISOString(),
              to: new Date(to * 1000).toISOString(),
            },
            seriesCount: data.series?.length || 0,
            data: limitedData,
          }),
        },
      ],
    };
  } catch (error) {
    console.error("Error handling query_metrics:", error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
    };
  }
}

/**
 * Handle get_metric_metadata tool request.
 * @param {Object} input - Tool input
 * @param {string} input.metricName - Metric name
 * @param {MetricsClient} client - Metrics API client
 * @returns {Promise<Object>} Tool result with metadata or error
 */
async function handleGetMetricMetadata(input, client) {
  try {
    if (!input.metricName || typeof input.metricName !== "string") {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: metricName must be a non-empty string",
          },
        ],
      };
    }

    const { data, error } = await client.getMetricMetadata(input.metricName);

    if (error) {
      console.error("Get metric metadata error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error retrieving metric metadata: ${error.message}`,
          },
        ],
      };
    }

    return {
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              metric: input.metricName,
              metadata: data,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    console.error("Error handling get_metric_metadata:", error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
    };
  }
}

/**
 * Handle list_metrics tool request.
 * @param {Object} input - Tool input
 * @param {string} [input.query] - Search query
 * @param {number} [input.limit] - Result limit
 * @param {MetricsClient} client - Metrics API client
 * @returns {Promise<Object>} Tool result with metrics list or error
 */
async function handleListMetrics(input, client) {
  try {
    const query = input.query || "";
    const limit = Math.min(input.limit || 100, 1000);

    const { data, error } = await client.listMetrics(query);

    if (error) {
      console.error("List metrics error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error listing metrics: ${error.message}`,
          },
        ],
      };
    }

    // Apply limit to results if needed
    const metrics = data.results || [];
    const limited = metrics.slice(0, limit);

    return {
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              query: query || "all",
              total: metrics.length,
              returned: limited.length,
              metrics: limited,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    console.error("Error handling list_metrics:", error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
    };
  }
}

/**
 * Get all metrics tools.
 * @param {MetricsClient} client - Metrics API client instance
 * @returns {Array<Object>} Array of tool definitions with handlers
 */
export function getMetricsTools(client) {
  return [
    {
      ...queryMetricsTool,
      handler: (input) => handleQueryMetrics(input, client),
    },
    {
      ...getMetricMetadataTool,
      handler: (input) => handleGetMetricMetadata(input, client),
    },
    {
      ...listMetricsTool,
      handler: (input) => handleListMetrics(input, client),
    },
  ];
}
