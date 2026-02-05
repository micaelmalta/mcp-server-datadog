/**
 * Tests for Datadog Events API client.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventsClient } from "#clients/eventsClient.js";
import { mockDatadogApi } from "#test/mocks/datadogApi.js";
import { createMockConfig, createTestTimestamps, assertValidResponse } from "#test/helpers.js";
import { eventsSearchResponse } from "#test/fixtures/datadogResponses.js";

describe("EventsClient", () => {
  let client;
  let timestamps;
  const { eventsApi } = mockDatadogApi;

  beforeEach(() => {
    vi.mocked(eventsApi.listEvents).mockReset();
    vi.mocked(eventsApi.getEvent).mockReset();
    eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);
    eventsApi.getEvent.mockResolvedValue({
      event: {
        id: 12345678,
        title: "Monitor Alert: High CPU",
        priority: "normal",
        date_happened: 1609459200,
      },
    });
    client = new EventsClient(createMockConfig());
    timestamps = createTestTimestamps();
  });

  describe("searchEvents", () => {
    it("should search events successfully", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);

      const { data, error } = await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
      expect(data.events).toBeDefined();
      expect(Array.isArray(data.events)).toBe(true);
    });

    it("should include query as tags in listEvents call", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);

      await client.searchEvents("priority:high", timestamps.from, timestamps.to);

      expect(eventsApi.listEvents).toHaveBeenCalledWith({
        start: Math.floor(timestamps.from),
        end: Math.floor(timestamps.to),
        tags: "priority:high",
      });
    });

    it("should handle empty query", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);

      const { data, error } = await client.searchEvents("", timestamps.from, timestamps.to);

      assertValidResponse({ data, error }, false);
      expect(eventsApi.listEvents).toHaveBeenCalledWith(expect.objectContaining({ tags: "" }));
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
      const err = new Error("Unauthorized");
      err.statusCode = 401;
      eventsApi.listEvents.mockRejectedValue(err);

      const { data, error } = await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(401);
    });

    it("should floor timestamps", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);
      const fromFloat = timestamps.from + 0.5;
      const toFloat = timestamps.to + 0.7;

      await client.searchEvents("priority:high", fromFloat, toFloat);

      expect(eventsApi.listEvents).toHaveBeenCalledWith({
        start: Math.floor(fromFloat),
        end: Math.floor(toFloat),
        tags: "priority:high",
      });
    });

    it("should include multiple events in response", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);

      const { data } = await client.searchEvents("priority:high", timestamps.from, timestamps.to);

      expect(data.events.length).toBeGreaterThan(1);
    });
  });

  describe("getEventDetails", () => {
    it("should get event details successfully", async () => {
      eventsApi.getEvent.mockResolvedValue({
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

    it("should call getEvent with eventId", async () => {
      eventsApi.getEvent.mockResolvedValue({ event: { id: 12345678 } });

      await client.getEventDetails(12345678);

      expect(eventsApi.getEvent).toHaveBeenCalledWith({ eventId: 12345678 });
    });

    it("should handle numeric zero event ID", async () => {
      eventsApi.getEvent.mockResolvedValue({ event: { id: 0 } });

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
      const err = new Error("Not Found");
      err.statusCode = 404;
      eventsApi.getEvent.mockRejectedValue(err);

      const { data, error } = await client.getEventDetails(99999999);

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(404);
    });

    it("should handle API errors", async () => {
      const err = new Error("Internal Server Error");
      err.statusCode = 500;
      eventsApi.getEvent.mockRejectedValue(err);

      const { data, error } = await client.getEventDetails(12345678);

      assertValidResponse({ data, error }, true);
      expect(error.statusCode).toBe(500);
    });

    it("should include large event IDs", async () => {
      eventsApi.getEvent.mockResolvedValue({ event: { id: 9999999999 } });

      const { data, error } = await client.getEventDetails(9999999999);

      assertValidResponse({ data, error }, false);
    });
  });

  describe("getMonitorEvents", () => {
    it("should get monitor events successfully", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);

      const { data, error } = await client.getMonitorEvents(
        1234567,
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
      expect(data.events).toBeDefined();
    });

    it("should include monitor_id in tags", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);

      await client.getMonitorEvents(1234567, timestamps.from, timestamps.to);

      expect(eventsApi.listEvents).toHaveBeenCalledWith(
        expect.objectContaining({ tags: "monitor_id:1234567" })
      );
    });

    it("should handle numeric zero monitor ID", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);

      const { data, error } = await client.getMonitorEvents(0, timestamps.from, timestamps.to);

      assertValidResponse({ data, error }, false);
    });

    it("should reject null monitor ID", async () => {
      const { data, error } = await client.getMonitorEvents(null, timestamps.from, timestamps.to);

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
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);

      const { data, error } = await client.searchEventsByAlertType(
        "error",
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
      expect(data.events).toBeDefined();
    });

    it("should include alert_type in tags", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);

      await client.searchEventsByAlertType("warning", timestamps.from, timestamps.to);

      expect(eventsApi.listEvents).toHaveBeenCalledWith(
        expect.objectContaining({ tags: "alert_type:warning" })
      );
    });

    it("should handle success alert type", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);

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
      const err = new Error("Bad Request");
      err.statusCode = 400;
      eventsApi.listEvents.mockRejectedValue(err);

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
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);

      const { data, error } = await client.searchEventsByTags(
        ["env:prod", "service:api"],
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
      expect(data.events).toBeDefined();
    });

    it("should include all tags in query", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);

      await client.searchEventsByTags(["env:prod", "service:api"], timestamps.from, timestamps.to);

      expect(eventsApi.listEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: "tags:env:prod AND tags:service:api",
        })
      );
    });

    it("should handle single tag", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);

      const { data, error } = await client.searchEventsByTags(
        ["env:prod"],
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
    });

    it("should reject null tags array", async () => {
      const { data, error } = await client.searchEventsByTags(null, timestamps.from, timestamps.to);

      assertValidResponse({ data, error }, true);
      expect(error.message).toContain("At least one tag is required");
    });

    it("should reject empty tags array", async () => {
      const { data, error } = await client.searchEventsByTags([], timestamps.from, timestamps.to);

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
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);

      const { data, error } = await client.searchEventsByTags(
        ["env:prod@v1", "service:api-gateway"],
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
    });

    it("should handle many tags", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);
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
    it("should use eventsApi when searching", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);

      await client.searchEvents("priority:high", timestamps.from, timestamps.to);

      expect(eventsApi.listEvents).toHaveBeenCalledTimes(1);
    });

    it("should support custom site domain", () => {
      const customClient = new EventsClient({
        ...createMockConfig(),
        site: "datadoghq.eu",
      });

      expect(customClient.site).toBe("datadoghq.eu");
    });
  });

  describe("error handling", () => {
    it("should handle 401 unauthorized", async () => {
      const err = new Error("Unauthorized");
      err.statusCode = 401;
      eventsApi.listEvents.mockRejectedValue(err);

      const { data: _data, error } = await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      expect(error.statusCode).toBe(401);
    });

    it("should handle 403 forbidden", async () => {
      const err = new Error("Forbidden");
      err.statusCode = 403;
      eventsApi.listEvents.mockRejectedValue(err);

      const { data: _data, error } = await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      expect(error.statusCode).toBe(403);
    });

    it("should handle 429 rate limit", async () => {
      const err = new Error("Too Many Requests");
      err.statusCode = 429;
      eventsApi.listEvents.mockRejectedValue(err);

      const { data: _data, error } = await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      expect(error.statusCode).toBe(429);
    });

    it("should handle 500 server error", async () => {
      const err = new Error("Internal Server Error");
      err.statusCode = 500;
      eventsApi.listEvents.mockRejectedValue(err);

      const { data: _data, error } = await client.searchEvents(
        "priority:high",
        timestamps.from,
        timestamps.to
      );

      expect(error.statusCode).toBe(500);
    });

    it("should preserve error details", async () => {
      const err = new Error("Bad Request");
      err.statusCode = 400;
      err.body = { errors: ["Invalid query"] };
      eventsApi.listEvents.mockRejectedValue(err);

      const { data: _data, error } = await client.searchEvents(
        "invalid:",
        timestamps.from,
        timestamps.to
      );

      expect(error.originalError).toBe(err);
    });
  });

  describe("edge cases", () => {
    it("should handle complex event queries", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);
      const complexQuery = "priority:high AND (alert_type:error OR alert_type:warning)";

      const { data, error } = await client.searchEvents(
        complexQuery,
        timestamps.from,
        timestamps.to
      );

      assertValidResponse({ data, error }, false);
    });

    it("should handle very old timestamps", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);
      const year2000From = 946684800; // 2000-01-01
      const year2000To = 946771200; // 2000-01-02

      const { data, error } = await client.searchEvents("priority:high", year2000From, year2000To);

      assertValidResponse({ data, error }, false);
    });

    it("should handle events with unicode text", async () => {
      eventsApi.listEvents.mockResolvedValue({
        ...eventsSearchResponse,
        events: [
          {
            ...eventsSearchResponse.events[0],
            title: "Alert: 日本語テキスト",
          },
        ],
      });

      const { data } = await client.searchEvents("priority:high", timestamps.from, timestamps.to);

      expect(data.events[0].title).toContain("日本語");
    });

    it("should handle responses with tags", async () => {
      eventsApi.listEvents.mockResolvedValue(eventsSearchResponse);

      const { data } = await client.searchEvents("priority:high", timestamps.from, timestamps.to);

      expect(data.events[0].tags).toBeDefined();
      expect(Array.isArray(data.events[0].tags)).toBe(true);
    });
  });
});
