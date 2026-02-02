import { MonitorsClient } from "../clients/monitorsClient.js";

/**
 * Tool definitions and handlers for Datadog Monitors API.
 * Provides tools to list, search, and get status of monitors.
 */

/**
 * List Monitors tool definition.
 * Lists monitors with optional filters for status and tags.
 * @type {Object}
 */
const listMonitorsTool = {
  name: "list_monitors",
  description:
    "List all Datadog monitors with optional filtering by status and tags. " +
    "Useful for getting an overview of all monitors in your account.",
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["triggered", "OK", "degraded"],
        description:
          "Filter monitors by status. 'triggered' shows active alerts, " +
          "'OK' shows healthy monitors, 'degraded' shows degraded monitors",
      },
      tags: {
        type: "array",
        items: {
          type: "string",
        },
        description:
          "Filter monitors by tags (e.g., [\"env:prod\", \"team:backend\"]). " +
          "Only monitors with all specified tags are returned.",
      },
    },
  },
};

/**
 * Get Monitor Status tool definition.
 * Retrieves detailed status information for a specific monitor.
 * @type {Object}
 */
const getMonitorStatusTool = {
  name: "get_monitor_status",
  description:
    "Get detailed status information for a specific monitor, including " +
    "alert status, downtime information, and historical state changes.",
  inputSchema: {
    type: "object",
    properties: {
      monitorId: {
        type: "string",
        description: "Unique identifier of the monitor",
      },
    },
    required: ["monitorId"],
  },
};

/**
 * Search Monitors tool definition.
 * Searches for monitors by name or other criteria.
 * @type {Object}
 */
const searchMonitorsTool = {
  name: "search_monitors",
  description:
    "Search for monitors by name or other criteria. Useful for finding " +
    "specific monitors when you don't remember the exact ID.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Search query string to match against monitor names and properties " +
          "(e.g., 'API latency', 'database')",
      },
      tags: {
        type: "array",
        items: {
          type: "string",
        },
        description: "Optional tag filters (e.g., [\"env:prod\", \"service:api\"])",
      },
    },
    required: ["query"],
  },
};

/**
 * Handle list_monitors tool request.
 * @param {Object} input - Tool input
 * @param {string} [input.status] - Status filter
 * @param {string[]} [input.tags] - Tag filters
 * @param {MonitorsClient} client - Monitors API client
 * @returns {Promise<Object>} Tool result with monitors or error
 */
async function handleListMonitors(input, client) {
  try {
    // Validate status if provided
    if (input.status) {
      const validStatuses = ["triggered", "OK", "degraded"];
      if (!validStatuses.includes(input.status)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text:
                "Error: status must be one of: " +
                "triggered, OK, degraded",
            },
          ],
        };
      }
    }

    // Build filters object
    const filters = {};

    if (input.status) {
      filters.status = input.status;
    }

    if (input.tags && Array.isArray(input.tags) && input.tags.length > 0) {
      filters.tags = input.tags;
    }

    // List monitors
    const { data, error } = await client.listMonitors(filters);

    if (error) {
      console.error("List monitors error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error listing monitors: ${error.message}`,
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
              filters: {
                status: input.status || "any",
                tags: input.tags || [],
              },
              monitorsCount: data.length || 0,
              monitors: data,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    console.error("Error handling list_monitors:", error);
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
 * Handle get_monitor_status tool request.
 * @param {Object} input - Tool input
 * @param {string} input.monitorId - Monitor ID
 * @param {MonitorsClient} client - Monitors API client
 * @returns {Promise<Object>} Tool result with monitor status or error
 */
async function handleGetMonitorStatus(input, client) {
  try {
    if (!input.monitorId && input.monitorId !== 0) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: monitorId must be a valid monitor identifier",
          },
        ],
      };
    }

    // Convert to number if it's a valid number string
    let monitorId = input.monitorId;
    if (typeof monitorId === "string") {
      const parsedId = parseInt(monitorId, 10);
      if (!Number.isNaN(parsedId)) {
        monitorId = parsedId;
      }
    }

    const { data, error } = await client.getMonitorStatus(monitorId);

    if (error) {
      console.error("Get monitor status error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error retrieving monitor status: ${error.message}`,
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
              monitorId: input.monitorId,
              status: data,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    console.error("Error handling get_monitor_status:", error);
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
 * Handle search_monitors tool request.
 * @param {Object} input - Tool input
 * @param {string} input.query - Search query
 * @param {string[]} [input.tags] - Tag filters
 * @param {MonitorsClient} client - Monitors API client
 * @returns {Promise<Object>} Tool result with monitors or error
 */
async function handleSearchMonitors(input, client) {
  try {
    if (!input.query || typeof input.query !== "string") {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: query must be a non-empty string",
          },
        ],
      };
    }

    // Search monitors
    const { data, error } = await client.searchMonitors(input.query);

    if (error) {
      console.error("Search monitors error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error searching monitors: ${error.message}`,
          },
        ],
      };
    }

    // Filter by tags if provided
    let results = data.monitors || [];

    if (input.tags && Array.isArray(input.tags) && input.tags.length > 0) {
      results = results.filter((monitor) => {
        const monitorTags = monitor.tags || [];
        return input.tags.every((tag) => monitorTags.includes(tag));
      });
    }

    return {
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              query: input.query,
              tags: input.tags || [],
              monitorsCount: results.length,
              monitors: results,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    console.error("Error handling search_monitors:", error);
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
 * Get all monitors tools.
 * @param {MonitorsClient} client - Monitors API client instance
 * @returns {Array<Object>} Array of tool definitions with handlers
 */
export function getMonitorsTools(client) {
  return [
    {
      ...listMonitorsTool,
      handler: (input) => handleListMonitors(input, client),
    },
    {
      ...getMonitorStatusTool,
      handler: (input) => handleGetMonitorStatus(input, client),
    },
    {
      ...searchMonitorsTool,
      handler: (input) => handleSearchMonitors(input, client),
    },
  ];
}
