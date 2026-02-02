import { describe, it, expect, beforeEach, vi } from "vitest";
import { getServicesTools } from "../../src/tools/servicesTools.js";

describe("Services Tools", () => {
  let mockClient;
  let tools;

  beforeEach(() => {
    mockClient = {
      getServiceDependencies: vi.fn(),
      getServiceDependenciesMultiEnv: vi.fn(),
    };
    tools = getServicesTools(mockClient);
  });

  describe("tool definitions", () => {
    it("should export 2 tools", () => {
      expect(tools).toHaveLength(2);
    });

    it("should have get_service_dependencies tool", () => {
      const tool = tools.find((t) => t.name === "get_service_dependencies");
      expect(tool).toBeDefined();
      expect(tool.inputSchema.required).toContain("env");
    });

    it("should have get_service_dependencies_multi_env tool", () => {
      const tool = tools.find((t) => t.name === "get_service_dependencies_multi_env");
      expect(tool).toBeDefined();
      expect(tool.inputSchema.required).toContain("envs");
    });
  });

  describe("get_service_dependencies tool", () => {
    it("should return error when env is missing", async () => {
      const tool = tools.find((t) => t.name === "get_service_dependencies");
      const result = await tool.handler({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("env must be a non-empty string");
    });

    it("should call client with correct parameters", async () => {
      mockClient.getServiceDependencies.mockResolvedValue({
        data: {
          services: [
            { name: "api", type: "service" },
            { name: "database", type: "database" },
          ],
          dependencies: [
            { from: "api", to: "database", callCount: 1000, errorCount: 5, latencyP99: 150 },
          ],
        },
        error: null,
      });

      const tool = tools.find((t) => t.name === "get_service_dependencies");
      const result = await tool.handler({
        env: "production",
        serviceName: "api",
      });

      expect(mockClient.getServiceDependencies).toHaveBeenCalledWith({
        env: "production",
        serviceName: "api",
      });
      expect(result.isError).toBe(false);
    });

    it("should handle client errors", async () => {
      mockClient.getServiceDependencies.mockResolvedValue({
        data: null,
        error: new Error("API Error"),
      });

      const tool = tools.find((t) => t.name === "get_service_dependencies");
      const result = await tool.handler({ env: "production" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error retrieving service dependencies");
    });
  });

  describe("get_service_dependencies_multi_env tool", () => {
    it("should return error when envs is empty", async () => {
      const tool = tools.find((t) => t.name === "get_service_dependencies_multi_env");
      const result = await tool.handler({ envs: [] });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("envs must be a non-empty array");
    });

    it("should call client for each environment", async () => {
      mockClient.getServiceDependenciesMultiEnv.mockResolvedValue({
        data: {
          production: {
            services: [{ name: "api", type: "service" }],
            dependencies: [],
          },
          staging: {
            services: [{ name: "api", type: "service" }],
            dependencies: [],
          },
        },
        error: null,
      });

      const tool = tools.find((t) => t.name === "get_service_dependencies_multi_env");
      const result = await tool.handler({
        envs: ["production", "staging"],
      });

      expect(mockClient.getServiceDependenciesMultiEnv).toHaveBeenCalledWith([
        "production",
        "staging",
      ]);
      expect(result.isError).toBe(false);
    });

    it("should handle partial failures", async () => {
      mockClient.getServiceDependenciesMultiEnv.mockResolvedValue({
        data: {
          production: {
            services: [{ name: "api", type: "service" }],
            dependencies: [],
          },
          staging: {
            error: new Error("Environment not found"),
          },
        },
        error: null,
      });

      const tool = tools.find((t) => t.name === "get_service_dependencies_multi_env");
      const result = await tool.handler({
        envs: ["production", "staging"],
      });

      expect(result.isError).toBe(false);
      // Result should contain data for both environments
      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.results.production.status).toBe("success");
    });
  });
});
