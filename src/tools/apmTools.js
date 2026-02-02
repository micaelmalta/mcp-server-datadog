/**
 * Tool definitions and handlers for Datadog APM/Traces API.
 * Provides tools to query traces and get service health and dependency information.
 */

/**
 * Convert various time formats to Unix timestamp in milliseconds.
 * @param {number | string} time - Time value (Unix seconds/ms, ISO 8601 string)
 * @param {boolean} asSeconds - If true, return as seconds; otherwise milliseconds
 * @returns {number} Unix timestamp
 * @private
 */
function parseApmTimestamp(time, asSeconds = false) {
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
 * Query Traces tool definition.
 * Retrieves APM traces for a service with optional filters.
 * @type {Object}
 */
const queryTracesTool = {
  name: "query_traces",
  description:
    "Query Datadog APM traces for a service. Returns trace data with " +
    "latency information and span details. Useful for performance debugging.",
  inputSchema: {
    type: "object",
    properties: {
      serviceName: {
        type: "string",
        description: 'Name of the service to query traces for (e.g., "api", "web")',
      },
      from: {
        oneOf: [{ type: "number" }, { type: "string" }],
        description:
          "Start time as Unix timestamp (seconds/ms) or ISO 8601 string",
      },
      to: {
        oneOf: [{ type: "number" }, { type: "string" }],
        description:
          "End time as Unix timestamp (seconds/ms) or ISO 8601 string " +
          "(must be after 'from')",
      },
      filter: {
        type: "string",
        description:
          "Optional trace filter (e.g., \"status:error\", \"http.status_code:500\"). " +
          "Use Datadog trace query syntax.",
      },
      limit: {
        type: "number",
        description: "Maximum number of traces to return (default: 100, max: 100)",
        default: 100,
      },
    },
    required: ["serviceName", "from", "to"],
  },
};

/**
 * Get Service Health tool definition.
 * Retrieves health metrics (latency, error rate, throughput) for a service.
 * @type {Object}
 */
const getServiceHealthTool = {
  name: "get_service_health",
  description:
    "Get health metrics for a service including latency, error rate, and throughput. " +
    "Useful for monitoring service performance and health status.",
  inputSchema: {
    type: "object",
    properties: {
      serviceName: {
        type: "string",
        description: "Name of the service to get health metrics for",
      },
      from: {
        oneOf: [{ type: "number" }, { type: "string" }],
        description:
          "Start time as Unix timestamp (seconds/ms) or ISO 8601 string",
      },
      to: {
        oneOf: [{ type: "number" }, { type: "string" }],
        description:
          "End time as Unix timestamp (seconds/ms) or ISO 8601 string",
      },
      env: {
        type: "string",
        description:
          "Optional environment to scope metrics (e.g. production, staging)",
      },
    },
    required: ["serviceName", "from", "to"],
  },
};

/**
 * Get Service Dependencies tool definition.
 * Retrieves the service dependency map showing how services communicate.
 * @type {Object}
 */
const getServiceDependenciesTool = {
  name: "get_service_dependencies",
  description:
    "Get the service dependency map for a service, showing which services " +
    "it calls and which services call it. Useful for understanding architecture.",
  inputSchema: {
    type: "object",
    properties: {
      serviceName: {
        type: "string",
        description:
          'Name of the service to get dependencies for (e.g., "api", "checkout")',
      },
      from: {
        oneOf: [{ type: "number" }, { type: "string" }],
        description:
          "Start time as Unix timestamp (seconds/ms) or ISO 8601 string",
      },
      to: {
        oneOf: [{ type: "number" }, { type: "string" }],
        description:
          "End time as Unix timestamp (seconds/ms) or ISO 8601 string",
      },
    },
    required: ["serviceName", "from", "to"],
  },
};

/**
 * Handle query_traces tool request.
 * @param {Object} input - Tool input
 * @param {string} input.serviceName - Service name
 * @param {number | string} input.from - Start timestamp
 * @param {number | string} input.to - End timestamp
 * @param {string} [input.filter] - Optional filter
 * @param {number} [input.limit] - Result limit
 * @param {ApmClient} client - APM API client
 * @returns {Promise<Object>} Tool result with traces or error
 */
async function handleQueryTraces(input, client) {
  try {
    // Validate and parse timestamps (APM API uses milliseconds)
    const from = parseApmTimestamp(input.from);
    const to = parseApmTimestamp(input.to);

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

    if (!input.serviceName || typeof input.serviceName !== "string") {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: serviceName must be a non-empty string",
          },
        ],
      };
    }

    const filter = input.filter || "";
    const limit = Math.min(input.limit || 100, 100);

    // Query traces (pass serviceName so client can use Spans API for real trace list)
    const { data, error } = await client.queryTraces(filter, from, to, {
      serviceName: input.serviceName,
      pageSize: limit,
    });

    if (error) {
      console.error("Query traces error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error querying traces: ${error.message}`,
          },
        ],
      };
    }

    // Summarize traces to reduce response size
    const traces = data.traces || [];
    const summarizedTraces = traces.slice(0, 50).map((t) => ({
      trace_id: t.trace_id,
      duration: t.duration,
      status: t.status,
      resource: t.resource?.substring(0, 150),
      service: t.service,
      span_count: t.span_count,
    }));

    return {
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            serviceName: input.serviceName,
            filter: filter || "all",
            timeRange: {
              from: new Date(from).toISOString(),
              to: new Date(to).toISOString(),
            },
            tracesCount: traces.length,
            traces: summarizedTraces,
          }),
        },
      ],
    };
  } catch (error) {
    console.error("Error handling query_traces:", error);
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
 * Handle get_service_health tool request.
 * @param {Object} input - Tool input
 * @param {string} input.serviceName - Service name
 * @param {number | string} input.from - Start timestamp
 * @param {number | string} input.to - End timestamp
 * @param {ApmClient} client - APM API client
 * @returns {Promise<Object>} Tool result with health metrics or error
 */
async function handleGetServiceHealth(input, client) {
  try {
    if (!input.serviceName || typeof input.serviceName !== "string") {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: serviceName must be a non-empty string",
          },
        ],
      };
    }

    // Validate and parse timestamps (APM API uses milliseconds)
    const from = parseApmTimestamp(input.from);
    const to = parseApmTimestamp(input.to);

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

    const { data, error } = await client.getServiceHealth(
      input.serviceName,
      from,
      to,
      { env: input.env }
    );

    if (error) {
      console.error("Get service health error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error retrieving service health: ${error.message}`,
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
              serviceName: input.serviceName,
              timeRange: {
                from: new Date(from).toISOString(),
                to: new Date(to).toISOString(),
              },
              health: data,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    console.error("Error handling get_service_health:", error);
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
 * Handle get_service_dependencies tool request.
 * @param {Object} input - Tool input
 * @param {string} input.serviceName - Service name
 * @param {number | string} input.from - Start timestamp
 * @param {number | string} input.to - End timestamp
 * @param {ApmClient} client - APM API client
 * @returns {Promise<Object>} Tool result with dependencies or error
 */
async function handleGetServiceDependencies(input, client) {
  try {
    if (!input.serviceName || typeof input.serviceName !== "string") {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: serviceName must be a non-empty string",
          },
        ],
      };
    }

    // Validate and parse timestamps (APM API uses milliseconds)
    const from = parseApmTimestamp(input.from);
    const to = parseApmTimestamp(input.to);

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

    const { data, error } = await client.getServiceDependencies(
      input.serviceName,
      from,
      to
    );

    if (error) {
      console.error("Get service dependencies error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error retrieving service dependencies: ${error.message}`,
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
              serviceName: input.serviceName,
              timeRange: {
                from: new Date(from).toISOString(),
                to: new Date(to).toISOString(),
              },
              dependencies: data,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    console.error("Error handling get_service_dependencies:", error);
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
 * Get all APM tools.
 * @param {ApmClient} client - APM API client instance
 * @returns {Array<Object>} Array of tool definitions with handlers
 */
export function getApmTools(client) {
  return [
    {
      ...queryTracesTool,
      handler: (input) => handleQueryTraces(input, client),
    },
    {
      ...getServiceHealthTool,
      handler: (input) => handleGetServiceHealth(input, client),
    },
    {
      ...getServiceDependenciesTool,
      handler: (input) => handleGetServiceDependencies(input, client),
    },
  ];
}
