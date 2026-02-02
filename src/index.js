import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getConfiguration } from "./utils/environment.js";
import { MetricsClient } from "./clients/metricsClient.js";
import { LogsClient } from "./clients/logsClient.js";
import { EventsClient } from "./clients/eventsClient.js";
import { MonitorsClient } from "./clients/monitorsClient.js";
import { ApmClient } from "./clients/apmClient.js";
import { ServicesClient } from "./clients/servicesClient.js";
import { getMetricsTools } from "./tools/metricsTools.js";
import { getLogsTools } from "./tools/logsTools.js";
import { getEventsTools } from "./tools/eventsTools.js";
import { getMonitorsTools } from "./tools/monitorsTools.js";
import { getApmTools } from "./tools/apmTools.js";
import { getServicesTools } from "./tools/servicesTools.js";

/**
 * Register all tool handlers with the MCP server.
 *
 * @param {Server} server - The MCP server instance
 * @param {Object} clients - Object containing all initialized API clients
 * @param {MetricsClient} clients.metricsClient - Metrics API client
 * @param {LogsClient} clients.logsClient - Logs API client
 * @param {EventsClient} clients.eventsClient - Events API client
 * @param {MonitorsClient} clients.monitorsClient - Monitors API client
 * @param {ApmClient} clients.apmClient - APM API client
 * @param {ServicesClient} clients.servicesClient - Services/Dependencies API client
 * @returns {Map<string, Function>} Map of tool names to handler functions
 * @private
 */
function registerTools(server, clients) {
  const toolMap = new Map();

  // Get tools from all modules
  const allTools = [
    ...getMetricsTools(clients.metricsClient),
    ...getLogsTools(clients.logsClient),
    ...getEventsTools(clients.eventsClient),
    ...getMonitorsTools(clients.monitorsClient),
    ...getApmTools(clients.apmClient),
    ...getServicesTools(clients.servicesClient),
  ];

  // Register tools with server and build handler map
  for (const tool of allTools) {
    // Extract handler function (don't include in tool definition)
    const { handler, ...toolDef } = tool;

    // Map tool name to handler
    toolMap.set(tool.name, handler);

    console.error(`Registered tool: ${tool.name}`);
  }

  return { toolMap, allTools };
}

/**
 * Initialize and start the MCP Datadog server.
 */
async function main() {
  // Load configuration
  const config = getConfiguration();

  // Initialize Datadog clients
  const metricsClient = new MetricsClient({
    apiKey: config.datadogApiKey,
    appKey: config.datadogAppKey,
    site: config.datadogSite,
  });

  const logsClient = new LogsClient({
    apiKey: config.datadogApiKey,
    appKey: config.datadogAppKey,
    site: config.datadogSite,
  });

  const eventsClient = new EventsClient({
    apiKey: config.datadogApiKey,
    appKey: config.datadogAppKey,
    site: config.datadogSite,
  });

  const monitorsClient = new MonitorsClient({
    apiKey: config.datadogApiKey,
    appKey: config.datadogAppKey,
    site: config.datadogSite,
  });

  const apmClient = new ApmClient({
    apiKey: config.datadogApiKey,
    appKey: config.datadogAppKey,
    site: config.datadogSite,
  });

  const servicesClient = new ServicesClient({
    apiKey: config.datadogApiKey,
    appKey: config.datadogAppKey,
    site: config.datadogSite,
  });

  // Initialize MCP server
  const server = new Server({
    name: config.mcpServerName,
    version: config.mcpServerVersion,
  });

  // Register capabilities - declare that this server supports tools
  server.registerCapabilities({
    tools: {},
  });

  // Register all tools and get handler map
  const { toolMap: toolHandlers, allTools } = registerTools(server, {
    metricsClient,
    logsClient,
    eventsClient,
    monitorsClient,
    apmClient,
    servicesClient,
  });

  // Create tool definitions without handlers for the MCP protocol
  const toolDefinitions = allTools.map((tool) => {
    const { handler, ...toolDef } = tool;
    return toolDef;
  });

  // Register tools/list handler using MCP SDK
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  // Register tools/call handler using MCP SDK
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = toolHandlers.get(name);

    if (!handler) {
      throw new Error(`Tool not found: ${name}`);
    }

    try {
      const result = await handler(args);
      return result;
    } catch (error) {
      console.error(`Error calling tool ${name}: ${error?.message ?? String(error)}`);
      throw error;
    }
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Datadog MCP server started successfully");
}

main().catch((error) => {
  console.error("Fatal error:", error?.message ?? String(error));
  process.exit(1);
});
