import { describe, it, expect, beforeEach, vi } from "vitest";
import { ServicesClient } from "../../src/clients/servicesClient.js";

describe("ServicesClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with config", () => {
    const testClient = new ServicesClient({
      apiKey: "test-key",
      appKey: "test-app-key",
      site: "datadoghq.com",
    });

    expect(testClient.apiKey).toBe("test-key");
    expect(testClient.appKey).toBe("test-app-key");
    expect(testClient.site).toBe("datadoghq.com");
  });

  it("should use default site", () => {
    const testClient = new ServicesClient({
      apiKey: "test-key",
      appKey: "test-app-key",
    });

    expect(testClient.site).toBe("datadoghq.com");
  });

  it("should return error when env is missing", async () => {
    const testClient = new ServicesClient({
      apiKey: "test-key",
      appKey: "test-app-key",
    });

    const { data: _data, error } = await testClient.getServiceDependencies({});
    expect(error).toBeDefined();
    expect(error.message).toContain("Environment (env) is required");
  });

  it("should handle client errors (non-403)", async () => {
    const { DatadogClientError } = await import("../../src/utils/errors.js");
    const testClient = new ServicesClient({
      apiKey: "test-key",
      appKey: "test-app-key",
    });
    vi.spyOn(testClient, "get").mockResolvedValue({
      data: null,
      error: new DatadogClientError("API Error", 500),
    });

    const { data: _data, error } = await testClient.getServiceDependencies({ env: "production" });
    expect(error).toBeDefined();
    expect(error.message).toContain("API Error");
  });

  it("should return empty data with message on 403 (API unavailable)", async () => {
    const { DatadogClientError } = await import("../../src/utils/errors.js");
    const testClient = new ServicesClient({
      apiKey: "test-key",
      appKey: "test-app-key",
    });
    vi.spyOn(testClient, "get").mockResolvedValue({
      data: null,
      error: new DatadogClientError("Forbidden", 403),
    });

    const { data, error } = await testClient.getServiceDependencies({ env: "production" });
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.dependencies).toEqual([]);
    expect(data.services).toEqual([]);
    expect(data.message).toContain("not available");
  });
});
