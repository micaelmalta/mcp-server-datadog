# MCP Datadog Server

A Model Context Protocol (MCP) server for integrating Datadog API capabilities with AI assistants and code editors.

## Overview

This project provides a comprehensive MCP server that enables AI tools to interact with Datadog APIs for:

- **Metrics**: Query and manage metrics data
- **Logs**: Search and analyze logs with filters
- **Events**: Query and manage Datadog events
- **Monitors**: List, search, and manage monitors
- **APM/Traces**: Query application traces and service health

## Quick Start

### 1. Configure and run

1. Copy `.env.example` to `.env` and set `DATADOG_API_KEY` and `DATADOG_APP_KEY`.
2. Add the MCP server to your client (e.g. Cursor/Claude) using stdio and `node src/index.js`.
3. Restart your editor; Datadog tools will be available.

### 2. Use the tools

Example tools: `search_logs`, `query_metrics`, `search_events`, `list_monitors`, `query_traces`, `get_service_health`.

**Example queries you can ask:**

- _"Show me error logs from the document-center service in the last hour"_ → `search_logs` with filter `service:document-center status:error`
- _"What's the CPU usage on production servers?"_ → `query_metrics` for `system.cpu.user`
- _"Are there any high-priority events in the last 24 hours?"_ → `search_events` with `priority:high`
- _"How is the API service performing?"_ → `get_service_health`

### 3. Tools overview

| Tool                       | Purpose               |
| -------------------------- | --------------------- |
| `search_logs`              | Query production logs |
| `query_metrics`            | Query metrics data    |
| `get_metric_metadata`      | Get metric info       |
| `list_metrics`             | List metrics          |
| `get_log_details`          | Log details           |
| `aggregate_logs`           | Log aggregation       |
| `search_events`            | Search events         |
| `get_event_details`        | Event details         |
| `list_monitors`            | List monitors         |
| `get_monitor_status`       | Monitor status        |
| `search_monitors`          | Search monitors       |
| `query_traces`             | APM traces            |
| `get_service_health`       | Service health        |
| `get_service_dependencies` | Service dependencies  |

### 4. Usage tips

- **Time ranges**: Use ISO 8601 (`"2026-02-01T12:00:00Z"`) or Unix timestamps (seconds or milliseconds).
- **Filters**: Datadog syntax, e.g. `service:document-center`, `status:error`, `env:production`, `host:prod-*`.
- **Logs**: Reliable filters include `service:...`, `status:error`, `env:production`, `level:ERROR`.
- **Metrics**: Examples: `system.cpu.user`, `system.memory.free`, `http.requests.count`, `app.latency.p99`.

### 5. Troubleshooting

- **Tools not available**: Restart your editor; ensure MCP server is configured and env vars are set.
- **API errors**: 403 → permissions; 404 → plan/feature; 400 → check filter syntax.
- **No data**: Check time range, try different filters, verify service/metric names.
- **Verify server**: Run `npm test` and `node src/index.js` (you should see tool registration messages).

### 6. Operational notes

- **Log file**: The server writes logs to `mcp_datadog.log` in the process working directory. Run from a directory with appropriate permissions and ensure the log file is not exposed (e.g. not in a world-readable path).
- **Rate limiting**: The server does not rate limit tool calls. Run it in a controlled environment; excessive use can hit Datadog API rate limits or quota.

### 7. MCP configuration example

Example entry for your MCP config (e.g. Cursor or Claude):

```json
{
  "datadog": {
    "type": "stdio",
    "command": "node",
    "args": ["/path/to/mcp_datadog/src/index.js"],
    "env": {
      "DATADOG_API_KEY": "your_api_key",
      "DATADOG_APP_KEY": "your_app_key"
    }
  }
}
```

---

## Architecture

The server is built with Node.js/JavaScript following the monorepo patterns used in Justworks services:

```
mcp_datadog/
├── src/
│   ├── clients/          # Datadog API clients
│   ├── tools/            # MCP tool handlers
│   ├── utils/            # Shared utilities
│   └── index.js          # Server entry point
├── test/                 # Test files
│   ├── fixtures/         # Mock data
│   └── setup.js          # Test configuration
└── docs/                 # Documentation
```

## Tech Stack

- **Runtime**: Node.js 20.20.0+
- **Language**: JavaScript (ES modules, no TypeScript compilation)
- **Type Hints**: JSDoc
- **Testing**: Vitest
- **Linting**: ESLint + Prettier
- **MCP SDK**: @modelcontextprotocol/sdk

## Setup

### Prerequisites

- Node.js 20.20.0 or later
- npm

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and add your Datadog credentials:

```bash
cp .env.example .env
```

Edit `.env` with your Datadog API key, app key, and site:

```env
DATADOG_API_KEY=<your-api-key>
DATADOG_APP_KEY=<your-app-key>
DATADOG_SITE=datadoghq.com
DATADOG_REGION=us1
```

## Development

### Available Commands

```bash
# Start server in development mode
npm run dev

# Run tests
npm test

# Watch tests for development
npm test:watch

# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Format code
npm run format

# Validate (lint + test)
npm run validate
```

## Project Structure

### Clients

Each client module wraps Datadog API endpoints with error handling:

- **metricsClient.js** - Metrics queries and metadata
- **logsClient.js** - Log searching and aggregation
- **eventsClient.js** - Event queries and filtering
- **monitorsClient.js** - Monitor management
- **apmClient.js** - APM traces and service health

### Utilities

- **environment.js** - Environment variable loading and validation
- **errors.js** - Custom error classes
- **apiClient.js** - Generic HTTP client with error handling

### Tools

MCP tool handlers for each API capability (to be implemented):

- Query metrics
- Search logs
- Find events
- Manage monitors
- Analyze traces

## API Client Pattern

All Datadog API clients follow a consistent error handling pattern:

```javascript
const { data, error } = await client.queryMetrics(query, from, to);
if (error) {
  console.error("Failed to query metrics:", error.message);
} else {
  console.log("Metrics data:", data);
}
```

## Testing

The project includes:

- Mock Datadog API responses in `test/fixtures/`
- Test setup with environment variables
- Vitest configuration with coverage support

Run tests with:

```bash
npm test        # Run once
npm test:watch  # Watch mode
npm run test:coverage  # With coverage report
```

## Error Handling

The project uses custom error classes for type-safe error handling:

- **DatadogClientError** - API request failures with HTTP status
- **MissingEnvironmentVariable** - Configuration errors
- **InvalidConfigurationError** - Invalid configuration values

## Coding Style

- ESLint with standard config + Prettier
- 100-character line limit
- JSDoc comments on all exported functions
- ES modules with path aliases for imports

## Contributing

1. Follow the existing code style (enforce with `npm run lint`)
2. Write tests for new functionality
3. Update this README if adding new capabilities
4. Run `npm run validate` before committing

## Links

- [Datadog API Documentation](https://docs.datadoghq.com/api/latest/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
