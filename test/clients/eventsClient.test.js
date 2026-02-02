/**
 * Tests for Datadog Events API client.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EventsClient } from "#clients/eventsClient.js";
import {
  mockSuccess,
  mockError,
  clearMocks,
  createMockConfig,
  createTestTimestamps,
  assertValidResponse,
  getLastFetchCall,
} from "#test/helpers.js";
import { eventsSearchResponse } from "#test/fixtures/datadogResponses.js";

describe("EventsClient", () => {
  let client;
  let timestamps;

  beforeEach(() => {
    clearMocks();
    client = new EventsClient(createMockConfig());
    timestamps = createTestTimestamps();
  });

  describe("searchEvents", () => {
    it("should search events successfully", async () => {
      mockSuccess(eventsSearchResponse);

      const { data, error } = await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
      expect(data.events).toBeDefined();
      expect(Array.isArray(data.events)).toBe(true);
    });

    it("should include query parameter", async () => {
      mockSuccess(eventsSearchResponse);

      await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      const [url] = getLastFetchCall();
      expect(url).toContain("query=priority%3Ahigh");
    });

    it("should handle empty query", async () => {
      mockSuccess(eventsSearchResponse);

      const { data, error } = await client.searchEvents(
        "",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
      const [url] = getLastFetchCall();
      expect(url).toContain("query=");
    });

    it("should use default page size of 10", async () => {
      mockSuccess(eventsSearchResponse);

      await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      const [url] = getLastFetchCall();
      expect(url).toContain("page_size=10");
    });

    it("should support custom page size", async () => {
      mockSuccess(eventsSearchResponse);

      await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to,
        { pageSize: 50 }
      );

      const [url] = getLastFetchCall();
      expect(url).toContain("page_size=50");
    });

    it("should enforce maximum page size of 100", async () => {
      mockSuccess(eventsSearchResponse);

      await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to,
        { pageSize: 200 }
      );

      const [url] = getLastFetchCall();
      expect(url).toContain("page_size=100");
    });

    it("should reject when from >= to", async () => {
      const { data, error } = await client.searchEvents(
        "priority:high",
        timestamps.to,
        timestamps.from
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Start time must be before end time");
    });

    it("should reject when from equals to", async () => {
      const { data, error } = await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.from
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Start time must be before end time");
    });

    it("should handle API errors", async () => {
      mockError({ status: 401, message: "Unauthorized" });

      const { data, error } = await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(401);
    });

    it("should floor timestamps", async () => {
      mockSuccess(eventsSearchResponse);
      const fromFloat = timestamps.from + 0.5;
      const toFloat = timestamps.to + 0.7;

      await client.searchEvents("priority:high", fromFloat, toFloat);

      const [url] = getLastFetchCall();
      expect(url).toContain(`start=${Math.floor(fromFloat)}`);
      expect(url).toContain(`end=${Math.floor(toFloat)}`);
    });

    it("should include multiple events in response", async () => {
      mockSuccess(eventsSearchResponse);

      const { data } = await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      expect(data.events.length).toBeGreaterThan(1);
    });
  });

  describe("getEventDetails", () => {
    it("should get event details successfully", async () => {
      mockSuccess({
        event: {
          id: 12345678,
          title: "Monitor Alert: High CPU",
          priority: "normal",
          date_happened: 1609459200,
        },
      });

      const { data, error } = await client.getEventDetails(12345678);

      assertValidResponse({ data, error }, false);
      expect(data.event).toBeDefined();
    });

    it("should handle numeric zero event ID", async () => {
      mockSuccess({ event: { id: 0 } });

      const { data, error } = await client.getEventDetails(0);

      assertValidResponse({ data, error }, false);
    });

    it("should reject null event ID", async () => {
      const { data, error } = await client.getEventDetails(null);

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Event ID is required");
    });

    it("should reject undefined event ID", async () => {
      const { data, error } = await client.getEventDetails(undefined);

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Event ID is required");
    });

    it("should handle 404 not found", async () => {
      mockError({ status: 404, message: "Not Found" });

      const { data, error } = await client.getEventDetails(99999999);

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(404);
    });

    it("should handle API errors", async () => {
      mockError({ status: 500, message: "Internal Server Error" });

      const { data, error } = await client.getEventDetails(12345678);

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(500);
    });

    it("should include large event IDs", async () => {
      mockSuccess({ event: { id: 9999999999 } });

      const { data, error } = await client.getEventDetails(9999999999);

      assertValidResponse({ data, error }, false);
    });
  });

  describe("getMonitorEvents", () => {
    it("should get monitor events successfully", async () => {
      mockSuccess(eventsSearchResponse);

      const { data, error } = await client.getMonitorEvents(
        1234567,
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
      expect(data.events).toBeDefined();
    });

    it("should include monitor_id in query", async () => {
      mockSuccess(eventsSearchResponse);

      await client.getMonitorEvents(
        1234567,
        timestamps.from,
        timestamps.to
      );

      const [url] = getLastFetchCall();
      expect(url).toContain("query=monitor_id%3A1234567");
    });

    it("should handle numeric zero monitor ID", async () => {
      mockSuccess(eventsSearchResponse);

      const { data, error } = await client.getMonitorEvents(
        0,
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
    });

    it("should reject null monitor ID", async () => {
      const { data, error } = await client.getMonitorEvents(
        null,
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Monitor ID is required");
    });

    it("should reject when from >= to", async () => {
      const { data, error } = await client.getMonitorEvents(
        1234567,
        timestamps.to,
        timestamps.from
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Start time must be before end time");
    });
  });

  describe("searchEventsByAlertType", () => {
    it("should search events by alert type", async () => {
      mockSuccess(eventsSearchResponse);

      const { data, error } = await client.searchEventsByAlertType(
        "error",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
      expect(data.events).toBeDefined();
    });

    it("should include alert_type in query", async () => {
      mockSuccess(eventsSearchResponse);

      await client.searchEventsByAlertType(
        "warning",
        timestamps.from,
        timestamps.to
      );

      const [url] = getLastFetchCall();
      expect(url).toContain("query=alert_type%3Awarning");
    });

    it("should handle success alert type", async () => {
      mockSuccess(eventsSearchResponse);

      const { data, error } = await client.searchEventsByAlertType(
        "success",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
    });

    it("should reject null alert type", async () => {
      const { data, error } = await client.searchEventsByAlertType(
        null,
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Alert type is required");
    });

    it("should reject empty alert type", async () => {
      const { data, error } = await client.searchEventsByAlertType(
        "",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("Alert type is required");
    });

    it("should handle API errors", async () => {
      mockError({ status: 400, message: "Bad Request" });

      const { data, error } = await client.searchEventsByAlertType(
        "error",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(400);
    });
  });

  describe("searchEventsByTags", () => {
    it("should search events by tags", async () => {
      mockSuccess(eventsSearchResponse);

      const { data, error } = await client.searchEventsByTags(
        ["env:prod", "service:api"],
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
      expect(data.events).toBeDefined();
    });

    it("should include all tags in query", async () => {
      mockSuccess(eventsSearchResponse);

      await client.searchEventsByTags(
        ["env:prod", "service:api"],
        timestamps.from,
        timestamps.to
      );

      const [url] = getLastFetchCall();
      expect(url).toContain("tags%3Aenv%3Aprod");
      expect(url).toContain("tags%3Aservice%3Aapi");
    });

    it("should handle single tag", async () => {
      mockSuccess(eventsSearchResponse);

      const { data, error } = await client.searchEventsByTags(
        ["env:prod"],
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
    });

    it("should reject null tags array", async () => {
      const { data, error } = await client.searchEventsByTags(
        null,
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("At least one tag is required");
    });

    it("should reject empty tags array", async () => {
      const { data, error } = await client.searchEventsByTags(
        [],
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("At least one tag is required");
    });

    it("should reject non-array tags", async () => {
      const { data, error } = await client.searchEventsByTags(
        "env:prod",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("At least one tag is required");
    });

    it("should handle tags with special characters", async () => {
      mockSuccess(eventsSearchResponse);

      const { data, error } = await client.searchEventsByTags(
        ["env:prod@v1", "service:api-gateway"],
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
    });

    it("should handle many tags", async () => {
      mockSuccess(eventsSearchResponse);
      const manyTags = Array.from({ length: 10 }, (_, i) => `tag${i}:value${i}`);

      const { data, error } = await client.searchEventsByTags(
        manyTags,
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
    });
  });

  describe("API integration", () => {
    it("should use v1 API base URL", () => {
      expect(client.client.baseUrl).toBe("https://api.datadoghq.com/api/v1");
    });

    it("should include DD-API-KEY header", async () => {
      mockSuccess(eventsSearchResponse);

      await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      const [, options] = getLastFetchCall();
      expect(options.headers["DD-API-KEY"]).toBe(createMockConfig().apiKey);
    });

    it("should include DD-APPLICATION-KEY header", async () => {
      mockSuccess(eventsSearchResponse);

      await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      const [, options] = getLastFetchCall();
      expect(options.headers["DD-APPLICATION-KEY"]).toBe(
        createMockConfig().appKey
      );
    });

    it("should support custom site domain", () => {
      const customClient = new EventsClient({
        ...createMockConfig(),
        site: "datadoghq.eu",
      });

      expect(customClient.client.baseUrl).toBe("https://api.datadoghq.eu/api/v1");
    });

    it("should use GET method for search", async () => {
      mockSuccess(eventsSearchResponse);

      await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      const [, options] = getLastFetchCall();
      expect(options.method).toBe("GET");
    });
  });

  describe("error handling", () => {
    it("should handle 401 unauthorized", async () => {
      mockError({ status: 401, message: "Unauthorized" });

      const { data: _data, error } = await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      expect(error.statusCode).toBe(401);
    });

    it("should handle 403 forbidden", async () => {
      mockError({ status: 403, message: "Forbidden" });

      const { data: _data, error } = await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      expect(error.statusCode).toBe(403);
    });

    it("should handle 429 rate limit", async () => {
      mockError({
        status: 429,
        message: "Too Many Requests",
      });

      const { data: _data, error } = await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      expect(error.statusCode).toBe(429);
    });

    it("should handle 500 server error", async () => {
      mockError({ status: 500, message: "Internal Server Error" });

      const { data: _data, error } = await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      expect(error.statusCode).toBe(500);
    });

    it("should preserve error details", async () => {
      mockError({
        status: 400,
        message: "Bad Request",
        errorData: { errors: ["Invalid query"] },
      });

      const { data: _data, error } = await client.searchEvents(
        "invalid:",
        timestamps.from,
        timestamps.to
      );

      expect(error.originalError).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle complex event queries", async () => {
      mockSuccess(eventsSearchResponse);
      const complexQuery = "priority:high AND (alert_type:error OR alert_type:warning)";

      const { data, error } = await client.searchEvents(
        complexQuery,
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
    });

    it("should handle very old timestamps", async () => {
      mockSuccess(eventsSearchResponse);
      const year2000From = 946684800; // 2000-01-01
      const year2000To = 946771200; // 2000-01-02

      const { data, error } = await client.searchEvents(
        "priority:high",
        year2000From,
        year2000To
      );

      assertValidResponse({ data, error }, false);
    });

    it("should handle events with unicode text", async () => {
      mockSuccess({
        ...eventsSearchResponse,
        events: [
          {
            ...eventsSearchResponse.events[0],
            title: "Alert: 日本語テキスト",
          },
        ],
      });

      const { data } = await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      expect(data.events[0].title).toContain("日本語");
    });

    it("should handle responses with tags", async () => {
      mockSuccess(eventsSearchResponse);

      const { data } = await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      expect(data.events[0].tags).toBeDefined();
      expect(Array.isArray(data.events[0].tags)).toBe(true);
    });
  });
});
