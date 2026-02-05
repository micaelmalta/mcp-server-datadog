# MCP Datadog Server

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that exposes Datadog APIs to AI assistants and code editors via tools.

## Overview

The server provides MCP tools for:

- **Metrics** – Query metrics, metadata, list metrics
- **Logs** – Search logs, get log details, aggregate logs
- **Events** – Search events, get event details
- **Monitors** – List monitors, get status, search monitors
- **APM/Traces** – Query traces, service health, service dependencies
- **Services** – Service dependencies (single and multi-environment)

## Quick Start

### Prerequisites

- Node.js 22+
- npm

### Run with npx (recommended)

No clone or install needed. Add the server to your MCP client (e.g. Cursor, Claude) using **stdio** and run it from GitHub:

```json
{
  "datadog": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "github:micaelmalta/mcp-server-datadog"],
    "env": {
      "DATADOG_API_KEY": "your_api_key",
      "DATADOG_APP_KEY": "your_app_key"
    }
  }
}
```

Set `DATADOG_API_KEY` and `DATADOG_APP_KEY` (and optionally `DATADOG_SITE`, default `datadoghq.com`). Restart the client so the tools appear.

To try from the terminal:

```bash
DATADOG_API_KEY=your_key DATADOG_APP_KEY=your_app_key npx -y github:micaelmalta/mcp-server-datadog
```

### Run from source

For development or a fixed install:

```bash
git clone https://github.com/micaelmalta/mcp-server-datadog.git
cd mcp-server-datadog
npm install
cp .env.example .env
```

Edit `.env` and set `DATADOG_API_KEY` and `DATADOG_APP_KEY`. Then:

```bash
npm start
# or with NODE_ENV=local: npm run dev
```

In your MCP config, use **stdio** with `node` and the path to the entry point:

```json
{
  "datadog": {
    "type": "stdio",
    "command": "node",
    "args": ["/path/to/mcp-server-datadog/src/index.js"],
    "env": {
      "DATADOG_API_KEY": "your_api_key",
      "DATADOG_APP_KEY": "your_app_key"
    }
  }
}
```

## Tools

| Tool                                 | Purpose                          |
| ------------------------------------ | -------------------------------- |
| `query_metrics`                      | Query metrics data               |
| `get_metric_metadata`                | Get metric metadata              |
| `list_metrics`                       | List metrics                     |
| `search_logs`                        | Search logs with filter          |
| `get_log_details`                    | Get a single log by ID           |
| `aggregate_logs`                     | Aggregate logs                   |
| `search_events`                      | Search events                    |
| `get_event_details`                  | Get event by ID                  |
| `list_monitors`                      | List monitors                    |
| `get_monitor_status`                 | Get monitor status               |
| `search_monitors`                    | Search monitors                  |
| `query_traces`                       | Query APM traces                 |
| `get_service_health`                 | Service health metrics           |
| `get_service_dependencies`           | Service dependencies             |
| `get_service_dependencies_multi_env` | Dependencies across environments |

**Example prompts:** _"Show error logs from service X in the last hour"_ → `search_logs`. _"What's CPU usage on production?"_ → `query_metrics`. _"How is the API service doing?"_ → `get_service_health`.

**Time ranges:** Use ISO 8601 or Unix timestamps (seconds for metrics/events, milliseconds for logs/APM). **Filters:** Datadog syntax, e.g. `service:api`, `status:error`, `env:production`.

## Project structure

```
mcp_datadog/
├── src/
│   ├── clients/     # Datadog API clients (SDK-based)
│   ├── tools/       # MCP tool definitions and handlers
│   ├── utils/       # Environment, errors, logger, toolErrors
│   └── index.js     # Server entry point
├── test/            # Vitest tests and fixtures
│   ├── benchmark/   # Tool handler benchmarks (mocked)
│   ├── mocks/      # Datadog SDK mocks
│   └── ...
├── docs/            # Additional documentation
└── package.json
```

**Tech stack:** Node.js 22+, JavaScript (ESM), JSDoc, Vitest, ESLint, Prettier, [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk), [@datadog/datadog-api-client](https://github.com/DataDog/datadog-api-client-typescript).

## Development

### Commands

| Command                 | Description                             |
| ----------------------- | --------------------------------------- |
| `npm start`             | Run server                              |
| `npm run dev`           | Run with NODE_ENV=local                 |
| `npm test`              | Run tests                               |
| `npm run test:watch`    | Tests in watch mode                     |
| `npm run test:coverage` | Tests with coverage                     |
| `npm run test:e2e`      | E2E tests (real Datadog API; see below) |
| `npm run benchmark`     | Run tool-handler benchmark (mocked)     |
| `npm run lint`          | Lint                                    |
| `npm run lint:fix`      | Fix lint issues                         |
| `npm run format`        | Format with Prettier                    |
| `npm run format:check`  | Check formatting (used in CI)           |
| `npm run validate`      | Lint + test                             |

### API client pattern

Clients return `{ data, error }`:

```javascript
const { data, error } = await client.queryMetrics(query, from, to);
if (error) {
  console.error(error.message, error.statusCode);
} else {
  console.log(data);
}
```

### CI

GitHub Actions (`.github/workflows/ci.yml`) runs on push and pull requests to `main`/`master`: format check (`prettier --check`), lint (ESLint), and tests. Same commands locally: `npm run format:check && npm run lint && npm test`.

### Testing

Tests use Vitest with mocked Datadog SDK (`test/mocks/datadogApi.js`) and fixtures in `test/fixtures/`. Run `npm test` before committing.

**E2E tests** (`test/e2e/`) run against the real Datadog API. They are skipped unless `RUN_E2E=1` and real `DATADOG_API_KEY`/`DATADOG_APP_KEY` are set in `.env`. Example: `RUN_E2E=1 npm run test:e2e`. Use this to verify that document-center production error logs are visible (e.g. `logsDocumentCenter.e2e.test.js`).

## Operational notes

- **Logging:** Tool calls are logged to **stderr** as JSON lines (`tool`, `durationMs`, `slow`). Optional: set `MCP_SLOW_TOOL_MS` (default 2000) to mark slow calls. Some clients also write to `mcp_datadog.log` (see `src/utils/logger.js`).
- **Rate limiting:** The server does not rate limit; high tool usage can hit Datadog API limits.
- **Troubleshooting:** Tools missing → check MCP config and env vars, restart client. 403/404 → permissions or plan. See [Troubleshooting](#troubleshooting) for "no data" cases.

## Troubleshooting

### Search returns 0 logs but I expect data

If `search_logs` (or `aggregate_logs`) returns no results for a service you know has traffic:

1. **Same Datadog org** – The MCP server uses `DATADOG_API_KEY`, `DATADOG_APP_KEY`, and optionally `DATADOG_SITE`. Ensure these point to the **same** Datadog org and site where your app (e.g. document-center) sends logs.
2. **Compare in Datadog** – In [Datadog Logs Explorer](https://docs.datadoghq.com/logs/explorer/), run the **same filter and time range** (e.g. `service:document-center env:production status:error`, last 7 days). If you see logs there but not via MCP, the env/site or keys are likely different.
3. **Exact filter syntax** – Confirm the attribute names and values your app sends (e.g. `service`, `env`, `status`). Try without `env:production` or with `env:prod`, or search only `service:document-center` to see if any logs appear.
4. **Retention and indexes** – Logs must be in an index that your API key can read; check [log indexes](https://docs.datadoghq.com/logs/indexes/) and retention.

## Documentation

- **README** (this file) – Setup, usage, structure.
- **CLAUDE.md** – Project conventions and patterns for contributors.
- **docs/** – Additional guides (e.g. performance, security) when present.

## Contributing

1. Follow existing style (`npm run lint`, `npm run format`).
2. Add tests for new behavior.
3. Run `npm run validate` before committing.
4. Use conventional commits: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`.

## Links

- [Datadog API](https://docs.datadoghq.com/api/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
