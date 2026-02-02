import { ServicesClient } from "../clients/servicesClient.js";

/**
 * Tool definitions and handlers for Datadog Service Dependencies API.
 * Provides tools to explore service dependencies and relationships.
 */

/**
 * Get Service Dependencies tool definition.
 * @type {Object}
 */
const getServiceDependenciesTool = {
  name: "get_service_dependencies",
  description:
    "Get service dependencies for a given environment. Returns all services and their relationships in the specified environment. " +
    "Useful for understanding service architecture and dependencies.",
  inputSchema: {
    type: "object",
    properties: {
      env: {
        type: "string",
        description:
          'The environment to query (e.g., "production", "staging", "development")',
      },
      serviceName: {
        type: "string",
        description:
          "Optional: Filter dependencies by a specific service name. If not provided, returns all services.",
      },
    },
    required: ["env"],
  },
};

/**
 * Get Service Dependencies Multi-Env tool definition.
 * @type {Object}
 */
const getServiceDependenciesMultiEnvTool = {
  name: "get_service_dependencies_multi_env",
  description:
    "Get service dependencies across multiple environments. Returns service relationships " +
    "for each specified environment, useful for comparing architectures across prod, staging, dev, etc.",
  inputSchema: {
    type: "object",
    properties: {
      envs: {
        type: "array",
        items: { type: "string" },
        description: 'Array of environments to query (e.g., ["production", "staging"])',
      },
    },
    required: ["envs"],
  },
};

/**
 * Handle get_service_dependencies tool request.
 * @param {Object} input - Tool input
 * @param {string} input.env - Environment name
 * @param {string} [input.serviceName] - Optional service name filter
 * @param {ServicesClient} client - Service Dependencies API client
 * @returns {Promise<Object>} Tool result with service dependencies or error
 */
async function handleGetServiceDependencies(input, client) {
  try {
    if (!input.env || typeof input.env !== "string") {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: env must be a non-empty string",
          },
        ],
      };
    }

    const { data, error } = await client.getServiceDependencies({
      env: input.env,
      serviceName: input.serviceName,
    });

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

    // Summarize and structure the response
    const dependencies = data?.dependencies || [];
    const services = data?.services || [];

    const summary = {
      service: input.serviceName || "all",
      environment: input.env,
      serviceName: input.serviceName || "all",
      serviceCount: services.length,
      dependencyCount: dependencies.length,
      ...(data?.message && { message: data.message }),
      services: services.slice(0, 50).map((svc) => ({
        name: svc.name,
        type: svc.type,
      })),
      dependencies: dependencies.slice(0, 100).map((dep) => ({
        from: dep.from,
        to: dep.to,
        callCount: dep.callCount,
        errorCount: dep.errorCount,
        latencyP99: dep.latencyP99,
      })),
    };

    return {
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify(summary, null, 2),
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
 * Handle get_service_dependencies_multi_env tool request.
 * @param {Object} input - Tool input
 * @param {string[]} input.envs - Array of environment names
 * @param {ServicesClient} client - Service Dependencies API client
 * @returns {Promise<Object>} Tool result with dependencies per environment or error
 */
async function handleGetServiceDependenciesMultiEnv(input, client) {
  try {
    if (!Array.isArray(input.envs) || input.envs.length === 0) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: envs must be a non-empty array of strings",
          },
        ],
      };
    }

    const { data, error } = await client.getServiceDependenciesMultiEnv(input.envs);

    if (error) {
      console.error("Get service dependencies multi-env error:", error);
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

    // Summarize results for each environment
    const summary = {
      environments: input.envs,
      results: {},
    };

    for (const env of input.envs) {
      if (data[env]?.error) {
        summary.results[env] = {
          status: "error",
          message: data[env].error.message,
        };
      } else {
        const envData = data[env];
        summary.results[env] = {
          status: "success",
          serviceCount: envData?.services?.length || 0,
          dependencyCount: envData?.dependencies?.length || 0,
          services: envData?.services?.slice(0, 20).map((s) => s.name) || [],
        };
      }
    }

    return {
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  } catch (error) {
    console.error("Error handling get_service_dependencies_multi_env:", error);
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
 * Get all services tools.
 * @param {ServicesClient} client - Service Dependencies API client instance
 * @returns {Array<Object>} Array of tool definitions with handlers
 */
export function getServicesTools(client) {
  return [
    {
      ...getServiceDependenciesTool,
      handler: (input) => handleGetServiceDependencies(input, client),
    },
    {
      ...getServiceDependenciesMultiEnvTool,
      handler: (input) => handleGetServiceDependenciesMultiEnv(input, client),
    },
  ];
}
