/**
 * Tool definitions and handlers for Datadog Logs API.
 * Provides tools to search logs, get details, and aggregate log data.
 */

import { formatToolError } from "#utils/toolErrors.js";

/**
 * Convert various time formats to Unix timestamp in milliseconds.
 * @param {number | string} time - Time value (Unix seconds/ms, ISO 8601 string)
 * @param {boolean} asSeconds - If true, return as seconds; otherwise milliseconds
 * @returns {number} Unix timestamp
 * @private
 */
function parseLogsTimestamp(time, asSeconds = false) {
  if (typeof time === "number") {
    // If number is small enough to be seconds, convert to ms
    if (time < 10000000000) {
      return asSeconds ? time : time * 1000;
    }
    return asSeconds ? Math.floor(time / 1000) : time;
  }

  if (typeof time === "string") {
    // Try ISO 8601 format
    const isoTime = new Date(time).getTime();
    if (!Number.isNaN(isoTime)) {
      return asSeconds ? Math.floor(isoTime / 1000) : isoTime;
    }

    // Try Unix seconds/ms
    const unixValue = parseInt(time, 10);
    if (!Number.isNaN(unixValue)) {
      if (asSeconds) {
        return unixValue < 10000000000 ? unixValue : Math.floor(unixValue / 1000);
      }
      return unixValue < 10000000000 ? unixValue * 1000 : unixValue;
    }
  }

  throw new Error(`Invalid timestamp format: ${time}`);
}

/**
 * Search Logs tool definition.
 * Searches logs with filters and returns matching log entries.
 * @type {Object}
 */
const searchLogsTool = {
  name: "search_logs",
  description:
    "Search Datadog logs with filters and a time range. Returns log entries " +
    "matching the query, useful for debugging and log analysis.",
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
  inputSchema: {
    type: "object",
    properties: {
      filter: {
        type: "string",
        description:
          'Log filter query (e.g., "service:api status:error", ' +
          '"host:prod-*"). Use Datadog query syntax.',
      },
      from: {
        oneOf: [{ type: "number" }, { type: "string" }],
        description: "Start time as Unix timestamp (seconds/ms) or ISO 8601 string",
      },
      to: {
        oneOf: [{ type: "number" }, { type: "string" }],
        description:
          "End time as Unix timestamp (seconds/ms) or ISO 8601 string " + "(must be after 'from')",
      },
      limit: {
        type: "number",
        description: "Maximum number of logs to return (default: 100, max: 100)",
        default: 100,
      },
    },
    required: ["filter", "from", "to"],
  },
};

/**
 * Get Log Details tool definition.
 * Retrieves full details of a specific log entry.
 * @type {Object}
 */
const getLogDetailsTool = {
  name: "get_log_details",
  description:
    "Get detailed information about a specific log entry. " +
    "Returns full log data including all attributes and metadata.",
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
  inputSchema: {
    type: "object",
    properties: {
      logId: {
        type: "string",
        description: "Unique identifier of the log entry to retrieve",
      },
    },
    required: ["logId"],
  },
};

/**
 * Aggregate Logs tool definition.
 * Aggregates log data using various aggregation functions.
 * @type {Object}
 */
const aggregateLogsTool = {
  name: "aggregate_logs",
  description:
    "Aggregate log data for a time range using the specified " +
    "aggregation type (count, avg, percentile, min, max, sum). " +
    "Useful for statistical analysis of logs.",
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
  inputSchema: {
    type: "object",
    properties: {
      filter: {
        type: "string",
        description: 'Log filter query (e.g., "status:error", "service:checkout")',
      },
      from: {
        oneOf: [{ type: "number" }, { type: "string" }],
        description: "Start time as Unix timestamp (seconds/ms) or ISO 8601 string",
      },
      to: {
        oneOf: [{ type: "number" }, { type: "string" }],
        description: "End time as Unix timestamp (seconds/ms) or ISO 8601 string",
      },
      aggregationType: {
        type: "string",
        enum: ["count", "avg", "percentile", "min", "max", "sum"],
        description:
          'Aggregation function to apply (e.g., "count" for log count, ' +
          '"avg" for average of numeric field)',
      },
    },
    required: ["filter", "from", "to", "aggregationType"],
  },
};

/**
 * Handle search_logs tool request.
 * @param {Object} input - Tool input
 * @param {string} input.filter - Log filter query
 * @param {number | string} input.from - Start timestamp
 * @param {number | string} input.to - End timestamp
 * @param {number} [input.limit] - Result limit
 * @param {LogsClient} client - Logs API client
 * @returns {Promise<Object>} Tool result with log entries or error
 */
async function handleSearchLogs(input, client) {
  try {
    // Validate and parse timestamps (logs API uses milliseconds)
    const from = parseLogsTimestamp(input.from);
    const to = parseLogsTimestamp(input.to);

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

    const filter = input.filter || "";
    const limit = Math.min(input.limit || 100, 100);

    const { data, error } = await client.searchLogs(filter, from, to, limit);

    if (error) {
      console.error("Search logs error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error searching logs: ${formatToolError(error.message, error?.statusCode)}`,
          },
        ],
      };
    }

    // Summarize logs to reduce response size
    // The v2 SDK returns logs in data.data (not data.logs)
    const logs = data?.data || data?.logs || [];

    const summarizedLogs = logs.map((log) => ({
      timestamp: log.timestamp,
      status: log.attributes?.status,
      service: log.attributes?.service,
      message: log.attributes?.message?.substring(0, 200), // Truncate long messages
      host: log.attributes?.host,
    }));

    const hasMore = !!(data?.links?.next || data?.meta?.page?.after);
    const nextCursor = data?.meta?.page?.after ?? null;

    return {
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            filter: filter || "all",
            timeRange: {
              from: new Date(from).toISOString(),
              to: new Date(to).toISOString(),
            },
            logsCount: logs.length,
            logs: summarizedLogs,
            has_more: hasMore,
            next_cursor: nextCursor,
          }),
        },
      ],
    };
  } catch (error) {
    console.error("Error handling search_logs:", error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error: ${formatToolError(error?.message ?? String(error), error?.statusCode)}`,
        },
      ],
    };
  }
}

/**
 * Handle get_log_details tool request.
 * @param {Object} input - Tool input
 * @param {string} input.logId - Log entry ID
 * @param {LogsClient} client - Logs API client
 * @returns {Promise<Object>} Tool result with log details or error
 */
async function handleGetLogDetails(input, client) {
  try {
    if (!input.logId || typeof input.logId !== "string") {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: logId must be a non-empty string",
          },
        ],
      };
    }

    const { data, error } = await client.getLogDetails(input.logId);

    if (error) {
      console.error("Get log details error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error retrieving log details: ${formatToolError(error.message, error?.statusCode)}`,
          },
        ],
      };
    }

    // Summarize details to reduce response size
    const summary = {
      logId: input.logId,
      timestamp: data.timestamp,
      status: data.attributes?.status,
      service: data.attributes?.service,
      message: data.attributes?.message,
      host: data.attributes?.host,
      tags: data.attributes?.tags?.slice(0, 10), // Limit tags
      attributes: Object.fromEntries(
        Object.entries(data.attributes || {})
          .slice(0, 15) // Limit total attributes
          .map(([k, v]) => [k, typeof v === "string" ? v.substring(0, 200) : v])
      ),
    };

    return {
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify(summary),
        },
      ],
    };
  } catch (error) {
    console.error("Error handling get_log_details:", error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error: ${formatToolError(error?.message ?? String(error), error?.statusCode)}`,
        },
      ],
    };
  }
}

/**
 * Handle aggregate_logs tool request.
 * @param {Object} input - Tool input
 * @param {string} input.filter - Log filter query
 * @param {number | string} input.from - Start timestamp
 * @param {number | string} input.to - End timestamp
 * @param {string} input.aggregationType - Aggregation type
 * @param {LogsClient} client - Logs API client
 * @returns {Promise<Object>} Tool result with aggregated data or error
 */
async function handleAggregateLogs(input, client) {
  try {
    // Validate and parse timestamps (logs API uses milliseconds)
    const from = parseLogsTimestamp(input.from);
    const to = parseLogsTimestamp(input.to);

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

    if (!input.aggregationType || typeof input.aggregationType !== "string") {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              "Error: aggregationType must be one of: " + "count, avg, percentile, min, max, sum",
          },
        ],
      };
    }

    const filter = input.filter || "";

    const { data, error } = await client.aggregateLogs(filter, from, to, input.aggregationType);

    if (error) {
      console.error("Aggregate logs error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error aggregating logs: ${formatToolError(error.message, error?.statusCode)}`,
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
              aggregationType: input.aggregationType,
              filter: filter || "all",
              timeRange: {
                from: new Date(from).toISOString(),
                to: new Date(to).toISOString(),
              },
              result: data,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    console.error("Error handling aggregate_logs:", error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error: ${formatToolError(error?.message ?? String(error), error?.statusCode)}`,
        },
      ],
    };
  }
}

/**
 * Get all logs tools.
 * @param {LogsClient} client - Logs API client instance
 * @returns {Array<Object>} Array of tool definitions with handlers
 */
export function getLogsTools(client) {
  return [
    {
      ...searchLogsTool,
      handler: (input) => handleSearchLogs(input, client),
    },
    {
      ...getLogDetailsTool,
      handler: (input) => handleGetLogDetails(input, client),
    },
    {
      ...aggregateLogsTool,
      handler: (input) => handleAggregateLogs(input, client),
    },
  ];
}
