/**
 * Tool definitions and handlers for Datadog Events API.
 * Provides tools to search events and get detailed event information.
 */

import { formatToolError } from "#utils/toolErrors.js";

/**
 * Convert various time formats to Unix timestamp in seconds.
 * @param {number | string} time - Time value (Unix seconds, ISO 8601 string)
 * @returns {number} Unix timestamp in seconds
 * @private
 */
function parseEventsTimestamp(time) {
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
 * Search Events tool definition.
 * Searches for events matching the query and time range.
 * @type {Object}
 */
const searchEventsTool = {
  name: "search_events",
  description:
    "Search for events in Datadog. Events can include monitor alerts, " +
    "deployments, integrations, and custom events. Useful for understanding " +
    "system changes and incidents.",
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          'Event search query (e.g., "priority:high", "monitor", ' +
          '"deployment"). Leave empty to search all events.',
      },
      from: {
        oneOf: [{ type: "number" }, { type: "string" }],
        description:
          "Start time as Unix timestamp in seconds or ISO 8601 string",
      },
      to: {
        oneOf: [{ type: "number" }, { type: "string" }],
        description:
          "End time as Unix timestamp in seconds or ISO 8601 string " +
          "(must be after 'from')",
      },
      priority: {
        type: "string",
        enum: ["low", "normal", "high"],
        description: "Filter events by priority level (optional)",
      },
    },
    required: ["query", "from", "to"],
  },
};

/**
 * Get Event Details tool definition.
 * Retrieves full details of a specific event.
 * @type {Object}
 */
const getEventDetailsTool = {
  name: "get_event_details",
  description:
    "Get detailed information about a specific event. " +
    "Returns full event data including timestamps, comments, and metadata.",
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
  inputSchema: {
    type: "object",
    properties: {
      eventId: {
        type: "string",
        description: "Unique identifier of the event to retrieve",
      },
    },
    required: ["eventId"],
  },
};

/**
 * Handle search_events tool request.
 * @param {Object} input - Tool input
 * @param {string} input.query - Event search query
 * @param {number | string} input.from - Start timestamp
 * @param {number | string} input.to - End timestamp
 * @param {string} [input.priority] - Priority filter
 * @param {EventsClient} client - Events API client
 * @returns {Promise<Object>} Tool result with events or error
 */
async function handleSearchEvents(input, client) {
  try {
    // Validate and parse timestamps (events API uses seconds)
    const from = parseEventsTimestamp(input.from);
    const to = parseEventsTimestamp(input.to);

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

    // Build query with priority filter if provided
    let query = input.query || "";

    if (input.priority) {
      const validPriorities = ["low", "normal", "high"];
      if (!validPriorities.includes(input.priority)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text:
                "Error: priority must be one of: " +
                "low, normal, high",
            },
          ],
        };
      }

      if (query) {
        query += ` priority:${input.priority}`;
      } else {
        query = `priority:${input.priority}`;
      }
    }

    // Search for events
    const { data, error } = await client.searchEvents(query, from, to);

    if (error) {
      console.error("Search events error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error searching events: ${formatToolError(error.message, error?.statusCode)}`,
          },
        ],
      };
    }

    // Summarize events to reduce response size
    const events = data.events || [];
    const summarizedEvents = events.slice(0, 50).map((e) => ({
      id: e.id,
      title: e.title,
      text: e.text?.substring(0, 300),
      priority: e.priority,
      status: e.status,
      tags: e.tags?.slice(0, 5),
      date_happened: e.date_happened,
    }));

    return {
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            query: query || "all",
            priority: input.priority || "all",
            timeRange: {
              from: new Date(from * 1000).toISOString(),
              to: new Date(to * 1000).toISOString(),
            },
            eventsCount: events.length,
            events: summarizedEvents,
          }),
        },
      ],
    };
  } catch (error) {
    console.error("Error handling search_events:", error);
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
 * Handle get_event_details tool request.
 * @param {Object} input - Tool input
 * @param {string} input.eventId - Event ID
 * @param {EventsClient} client - Events API client
 * @returns {Promise<Object>} Tool result with event details or error
 */
async function handleGetEventDetails(input, client) {
  try {
    if (!input.eventId && input.eventId !== 0) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: eventId must be a valid event identifier",
          },
        ],
      };
    }

    // Convert to number if it's a valid number string
    let eventId = input.eventId;
    if (typeof eventId === "string") {
      const parsedId = parseInt(eventId, 10);
      if (!Number.isNaN(parsedId)) {
        eventId = parsedId;
      }
    }

    const { data, error } = await client.getEventDetails(eventId);

    if (error) {
      console.error("Get event details error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error retrieving event details: ${formatToolError(error.message, error?.statusCode)}`,
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
              eventId: input.eventId,
              details: data,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    console.error("Error handling get_event_details:", error);
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
 * Get all events tools.
 * @param {EventsClient} client - Events API client instance
 * @returns {Array<Object>} Array of tool definitions with handlers
 */
export function getEventsTools(client) {
  return [
    {
      ...searchEventsTool,
      handler: (input) => handleSearchEvents(input, client),
    },
    {
      ...getEventDetailsTool,
      handler: (input) => handleGetEventDetails(input, client),
    },
  ];
}
