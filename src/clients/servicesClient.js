import { ApiClient } from "../utils/apiClient.js";
import { DatadogClientError } from "../utils/errors.js";
import { Logger } from "../utils/logger.js";

/**
 * Datadog Service Dependencies API client (APM Service Map).
 * Uses the v1 API: https://docs.datadoghq.com/api/latest/service-dependencies/
 */
export class ServicesClient extends ApiClient {
  /**
   * @param {Object} config - Client configuration
   * @param {string} config.apiKey - Datadog API key
   * @param {string} config.appKey - Datadog app key
   * @param {string} config.site - Datadog site (default: datadoghq.com)
   */
  constructor(config) {
    const site = config.site || "datadoghq.com";
    const baseUrl = `https://api.${site}/api/v1`;

    super({
      baseUrl,
      headers: {
        "DD-API-KEY": config.apiKey,
        "DD-APPLICATION-KEY": config.appKey,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    this.apiKey = config.apiKey;
    this.appKey = config.appKey;
    this.site = site;
  }

  /**
   * Normalize v1 "get all" response (map of service -> { calls: [] }) to { services, dependencies }.
   * @param {Object} raw - Raw API response
   * @returns {{ services: Array<{name: string, type: string}>, dependencies: Array<{from: string, to: string}>}}
   */
  static normalizeGetAllResponse(raw) {
    const services = [];
    const dependencies = [];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const [name, entry] of Object.entries(raw)) {
        if (entry && typeof entry === "object" && Array.isArray(entry.calls)) {
          services.push({ name, type: "service" });
          for (const to of entry.calls) {
            dependencies.push({ from: name, to });
          }
        }
      }
    }
    return { services, dependencies };
  }

  /**
   * Normalize v1 "get one service" response to { services, dependencies }.
   * @param {Object} raw - Raw API response { called_by, calls, name }
   * @returns {{ services: Array<{name: string, type: string}>, dependencies: Array<{from: string, to: string}>}}
   */
  static normalizeGetOneResponse(raw) {
    const services = [];
    const dependencies = [];
    if (raw && typeof raw === "object") {
      const name = raw.name || "";
      const calls = Array.isArray(raw.calls) ? raw.calls : [];
      const calledBy = Array.isArray(raw.called_by) ? raw.called_by : [];
      const allNames = new Set([name, ...calls, ...calledBy]);
      for (const n of allNames) {
        if (n) services.push({ name: n, type: "service" });
      }
      for (const to of calls) {
        dependencies.push({ from: name, to });
      }
      for (const from of calledBy) {
        dependencies.push({ from, to: name });
      }
    }
    return { services, dependencies };
  }

  /**
   * Get service dependencies for a given environment.
   * Uses GET /api/v1/service_dependencies (all) or /api/v1/service_dependencies/{service} (one).
   * @param {Object} [options] - Query options
   * @param {string} [options.env] - The environment to get dependencies for (e.g., "production")
   * @param {string} [options.serviceName] - Optional: get dependencies for this service only
   * @param {string} [options.primaryTag] - Optional: primary tag filter
   * @param {number} [options.start] - Optional: start of timeframe (epoch seconds)
   * @param {number} [options.end] - Optional: end of timeframe (epoch seconds)
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async getServiceDependencies(options = {}) {
    try {
      if (!options.env) {
        return {
          data: null,
          error: new DatadogClientError("Environment (env) is required"),
        };
      }

      const params = new URLSearchParams();
      params.append("env", options.env);
      if (options.primaryTag) params.append("primary_tag", options.primaryTag);
      if (options.start != null) params.append("start", String(options.start));
      if (options.end != null) params.append("end", String(options.end));

      const path = options.serviceName
        ? `/service_dependencies/${encodeURIComponent(options.serviceName)}?${params.toString()}`
        : `/service_dependencies?${params.toString()}`;

      Logger.log("ServicesClient", "Requesting service dependencies", {
        baseUrl: this.baseUrl,
        path,
        env: options.env,
        serviceName: options.serviceName || "none",
      });

      const { data, error } = await this.get(path);

      if (error) {
        Logger.error("ServicesClient", "Failed to get service dependencies", error);
        const status =
          error instanceof DatadogClientError
            ? error.statusCode
            : error.message?.includes("403")
              ? 403
              : error.message?.includes("404")
                ? 404
                : null;
        if (status === 403 || status === 404 || error.message?.includes("403") || error.message?.includes("404")) {
          return {
            data: {
              dependencies: [],
              services: [],
              message:
                "Service Dependencies API not available or insufficient permissions. " +
                "This feature may require APM and the apm_read scope in your Datadog org.",
            },
            error: null,
          };
        }
        return { data: null, error };
      }

      const normalized = options.serviceName
        ? ServicesClient.normalizeGetOneResponse(data)
        : ServicesClient.normalizeGetAllResponse(data);

      Logger.log("ServicesClient", "Successfully retrieved service dependencies", {
        dependenciesCount: normalized.dependencies.length,
        servicesCount: normalized.services.length,
      });

      return {
        data: normalized,
        error: null,
      };
    } catch (error) {
      Logger.error("ServicesClient", "Exception in getServiceDependencies", error);
      return {
        data: null,
        error:
          error instanceof DatadogClientError
            ? error
            : new DatadogClientError(`HTTP ${error.statusCode || 500}: ${error.message}`),
      };
    }
  }

  /**
   * Get service dependencies for multiple environments.
   * @param {string[]} envs - Array of environments to query
   * @returns {Promise<{data: Object, error: null} | {data: null, error: Error}>}
   */
  async getServiceDependenciesMultiEnv(envs = []) {
    try {
      if (!Array.isArray(envs) || envs.length === 0) {
        return {
          data: null,
          error: new DatadogClientError("At least one environment is required"),
        };
      }

      const results = {};

      for (const env of envs) {
        const result = await this.getServiceDependencies({ env, serviceName: undefined });
        if (result.error) {
          results[env] = { error: result.error };
        } else {
          results[env] = result.data;
        }
      }

      return { data: results, error: null };
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof DatadogClientError
            ? error
            : new DatadogClientError(`HTTP ${error.statusCode || 500}: ${error.message}`),
      };
    }
  }
}
