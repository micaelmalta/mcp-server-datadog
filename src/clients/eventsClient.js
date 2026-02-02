import { client, v1 } from "@datadog/datadog-api-client";
import { DatadogClientError } from "../utils/errors.js";

/**
 * Datadog Events API client using official Datadog SDK
 */
export class EventsClient {
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

    this.eventsApi = new v1.EventsApi(configuration);
  }

  /**
   * Search for events in Datadog.
   * @param {string} query - Event query filter (e.g., "priority:high")
   * @param {number} from - Unix timestamp (seconds) for start time
   * @param {number} to - Unix timestamp (seconds) for end time
   * @param {Object} options - Additional options
   * @param {number} options.pageSize - Number of events per page (default: 10)
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async searchEvents(query = "", from, to, options = {}) {
    try {
      if (from >= to) {
        return {
          data: null,
          error: new DatadogClientError("Start time must be before end time"),
        };
      }

      const pageSize = Math.min(options.pageSize || 10, 100);

      const result = await this.eventsApi.listEvents({
        start: Math.floor(from),
        end: Math.floor(to),
        tags: query,
      });

      return { data: result, error: null };
    } catch (error) {
      return {
        data: null,
        error: new DatadogClientError(`HTTP ${error.statusCode || 500}: ${error.message}`),
      };
    }
  }

  /**
   * Get detailed information about a specific event.
   * @param {number} eventId - The unique ID of the event
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async getEventDetails(eventId) {
    try {
      if (!eventId && eventId !== 0) {
        return {
          data: null,
          error: new DatadogClientError("Event ID is required"),
        };
      }

      const result = await this.eventsApi.getEvent({ eventId });
      return { data: result, error: null };
    } catch (error) {
      return {
        data: null,
        error: new DatadogClientError(`HTTP ${error.statusCode || 500}: ${error.message}`),
      };
    }
  }

  /**
   * Get events for a specific monitor.
   * @param {number} monitorId - The monitor ID
   * @param {number} from - Unix timestamp (seconds) for start time
   * @param {number} to - Unix timestamp (seconds) for end time
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async getMonitorEvents(monitorId, from, to) {
    try {
      if (!monitorId && monitorId !== 0) {
        return {
          data: null,
          error: new DatadogClientError("Monitor ID is required"),
        };
      }

      if (from >= to) {
        return {
          data: null,
          error: new DatadogClientError("Start time must be before end time"),
        };
      }

      const query = `monitor_id:${monitorId}`;
      return this.searchEvents(query, from, to);
    } catch (error) {
      return {
        data: null,
        error: new DatadogClientError(`HTTP ${error.statusCode || 500}: ${error.message}`),
      };
    }
  }

  /**
   * Search events by alert type.
   * @param {string} alertType - The alert type (e.g., "error", "warning")
   * @param {number} from - Unix timestamp (seconds) for start time
   * @param {number} to - Unix timestamp (seconds) for end time
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async searchEventsByAlertType(alertType, from, to) {
    try {
      if (!alertType) {
        return {
          data: null,
          error: new DatadogClientError("Alert type is required"),
        };
      }

      const query = `alert_type:${alertType}`;
      return this.searchEvents(query, from, to);
    } catch (error) {
      return {
        data: null,
        error: new DatadogClientError(`HTTP ${error.statusCode || 500}: ${error.message}`),
      };
    }
  }

  /**
   * Search events by tags.
   * @param {string[]} tags - Array of tags to filter by
   * @param {number} from - Unix timestamp (seconds) for start time
   * @param {number} to - Unix timestamp (seconds) for end time
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async searchEventsByTags(tags, from, to) {
    try {
      if (!Array.isArray(tags) || tags.length === 0) {
        return {
          data: null,
          error: new DatadogClientError("At least one tag is required"),
        };
      }

      // Validate tags to prevent query injection (no embedded AND/OR, reasonable length)
      const safeTags = [];
      for (const tag of tags) {
        const t = typeof tag === "string" ? tag.trim() : "";
        if (!t || t.length > 256) {
          return {
            data: null,
            error: new DatadogClientError(
              "Each tag must be a non-empty string of at most 256 characters"
            ),
          };
        }
        if (/ AND | OR /i.test(t)) {
          return {
            data: null,
            error: new DatadogClientError(
              "Tags must not contain ' AND ' or ' OR ' (reserved query syntax)"
            ),
          };
        }
        safeTags.push(t);
      }

      const query = safeTags.map((tag) => `tags:${tag}`).join(" AND ");
      return this.searchEvents(query, from, to);
    } catch (error) {
      return {
        data: null,
        error: new DatadogClientError(`HTTP ${error.statusCode || 500}: ${error.message}`),
      };
    }
  }
}
