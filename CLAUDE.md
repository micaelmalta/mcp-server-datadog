# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Datadog is a Node.js Model Context Protocol (MCP) server that exposes Datadog monitoring APIs to AI assistants. It provides tools for querying metrics, logs, events, monitors, APM traces, and service dependencies.

## Tech Stack

- **Runtime**: Node.js 20.20.0+ (ES modules)
- **Language**: JavaScript with JSDoc type hints (NO TypeScript)
- **MCP Framework**: @modelcontextprotocol/sdk
- **Datadog SDK**: @datadog/datadog-api-client
- **Testing**: Vitest with SDK mocks
- **Linting**: ESLint (standard config) + Prettier

## Architecture

### Three-layer Architecture

1. **Clients** (`src/clients/`) - SDK wrappers for Datadog APIs
   - Use official @datadog/datadog-api-client SDK
   - Return `{ data, error }` tuples (never throw)
   - Validate inputs before API calls
   - Transform SDK responses to consistent format

2. **Tools** (`src/tools/`) - MCP tool definitions and handlers
   - Define tool schemas (name, description, inputSchema)
   - Include handler function that uses client
   - Format errors with actionable hints via `formatToolError()`
   - Return MCP-compliant responses

3. **Server** (`src/index.js`) - MCP server initialization
   - Initialize all clients with config
   - Register tools with MCP SDK
   - Handle tool calls with timing/logging
   - Log to stderr as JSON lines for observability

### Path Aliases

All imports use path aliases defined in jsconfig.json and vitest.config.js:

```javascript
import { formatToolError } from "#utils/toolErrors.js";
import { MetricsClient } from "#clients/metricsClient.js";
import { getMetricsTools } from "#tools/metricsTools.js";
import { mockDatadogApi } from "#test/mocks/datadogApi.js";
```

### Client Pattern

Clients wrap Datadog SDK APIs and return `{ data, error }` tuples:

```javascript
async queryMetrics(query, from, to) {
  try {
    // Input validation
    if (!query) {
      return { data: null, error: new DatadogClientError("Query required") };
    }

    // Call SDK
    const result = await this.metricsApi.queryMetrics({ from, to, query });
    return { data: result, error: null };
  } catch (error) {
    const statusCode = error.statusCode ?? 500;
    return {
      data: null,
      error: new DatadogClientError(
        `HTTP ${statusCode}: ${error.message}`,
        statusCode,
        error
      ),
    };
  }
}
```

**Never throw errors from clients** - always return error in tuple.

### Tool Pattern

Tools consist of a definition object with a handler function:

```javascript
const toolDefinition = {
  name: "query_metrics",
  description: "Query Datadog metrics...",
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
  inputSchema: { /* JSON schema */ },
};

const handler = async (args) => {
  const { data, error } = await client.queryMetrics(args.query, from, to);

  if (error) {
    return {
      content: [{ type: "text", text: formatToolError(error.message, error.statusCode) }],
      isError: true,
    };
  }

  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
};

export function getMetricsTools(client) {
  return [{ ...toolDefinition, handler }];
}
```

**Always use `formatToolError()`** for error messages to provide actionable hints.

### Testing Pattern

Tests use mocked Datadog SDK from `test/mocks/datadogApi.js`:

```javascript
import { mockDatadogApi } from "#test/mocks/datadogApi.js";

it("should query metrics", async () => {
  // Arrange
  mockDatadogApi.metricsApi.queryMetrics.mockResolvedValue({ series: [...] });

  // Act
  const { data, error } = await client.queryMetrics("avg:cpu{*}", from, to);

  // Assert
  expect(error).toBeNull();
  expect(data).toBeDefined();
  expect(mockDatadogApi.metricsApi.queryMetrics).toHaveBeenCalledWith({
    from,
    to,
    query: "avg:cpu{*}",
  });
});
```

Run single test file:
```bash
npm test -- test/clients/metricsClient.test.js
```

## Development Commands

| Command | Purpose |
|---------|---------|
| `npm start` | Run MCP server (stdio transport) |
| `npm run dev` | Run with NODE_ENV=local |
| `npm test` | Run all tests once |
| `npm test -- <file>` | Run single test file |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run with coverage report |
| `npm run benchmark` | Run tool handler benchmarks |
| `npm run lint` | Check code style (ESLint) |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format with Prettier |
| `npm run validate` | Run lint + test (pre-commit) |

## Adding Features

### Adding a new API client

1. Create `src/clients/<domain>Client.js`
2. Import SDK classes: `import { client, v1 } from "@datadog/datadog-api-client"`
3. Configure SDK in constructor with apiKey/appKey/site
4. Implement methods using SDK API classes
5. Return `{ data, error }` tuples (never throw)
6. Add JSDoc for all public methods
7. Create test file in `test/clients/` with SDK mocks

### Adding a new tool

1. Create `src/tools/<tool>Tools.js`
2. Define tool schema with inputSchema following JSON Schema
3. Add MCP hints: readOnlyHint, destructiveHint, idempotentHint, openWorldHint
4. Implement handler using corresponding client
5. Use `formatToolError()` for all error messages
6. Export function that returns array of tools with handlers
7. Register in `src/index.js` by importing and calling in `registerTools()`
8. Add test file in `test/tools/` with mocked client

### Tool schema hints (MCP best practices)

- `readOnlyHint: true` - Tool doesn't modify state (queries, reads)
- `destructiveHint: true` - Tool modifies/deletes data (use sparingly)
- `idempotentHint: true` - Safe to retry, same result
- `openWorldHint: true` - May return no results (searches, filters)

## Error Handling

### Custom errors (src/utils/errors.js)

- `DatadogClientError` - API failures, includes statusCode
- `MissingEnvironmentVariable` - Missing required env vars
- `InvalidConfigurationError` - Config validation failures

### Actionable error messages (src/utils/toolErrors.js)

`formatToolError(message, statusCode)` adds hints for common errors:

- 401/403 → "Check DATADOG_API_KEY and DATADOG_APP_KEY..."
- 404 → "No resource found. Check the ID or query..."
- 429 → "Datadog rate limit hit. Retry after a short delay..."
- Time range errors → "Ensure 'from' is before 'to'."

Always use this for tool error responses to guide AI agents.

## Environment Variables

Required for server to start:

- `DATADOG_API_KEY` - Datadog API key
- `DATADOG_APP_KEY` - Datadog application key

Optional with defaults:

- `DATADOG_SITE` - Datadog site (default: datadoghq.com)
- `DATADOG_REGION` - Region code (default: us1)
- `NODE_ENV` - Environment (default: local)
- `MCP_SERVER_NAME` - Server name (default: datadog)
- `MCP_SERVER_VERSION` - Version (default: 1.0.0)
- `MCP_SLOW_TOOL_MS` - Slow tool threshold for logging (default: 2000)

Load with `getConfiguration()` from `src/utils/environment.js`.

## Observability

### Tool call logging

Server logs all tool calls to **stderr** as JSON lines:

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "level": "info",
  "message": "tool_call",
  "tool": "query_metrics",
  "durationMs": 450,
  "slow": false
}
```

Set `MCP_SLOW_TOOL_MS` environment variable to customize slow threshold (default 2000ms).

### Benchmark tests

Run `npm run benchmark` to measure tool handler performance with mocked APIs. Tests in `test/benchmark/`.

## Code Style

- **Line length**: 100 characters (Prettier enforced)
- **Quotes**: Double quotes for strings
- **Semicolons**: Required (ESLint standard config)
- **Unused vars**: Prefix with `_` to ignore (e.g., `_unused`)
- **JSDoc**: Required for all exported functions/classes
- **Imports**: Path aliases (#utils, #clients, #tools, #test)

### ESLint rules

- Extends: eslint-config-standard, prettier
- Test files: No import ordering, no-use-before-define disabled
- Unused variables with `_` prefix are allowed

## Time Handling

Different Datadog APIs use different time formats:

- **Metrics/Events**: Unix timestamps in **seconds**
- **Logs/APM**: Unix timestamps in **milliseconds**
- **ISO 8601**: All APIs accept ISO strings (e.g., "2025-01-15T10:30:00Z")

Tools should accept both formats and convert using helper functions (see `metricsTools.js` parseTimestamp).

## Git Workflow

Conventional commits required:

- `feat(scope): description` - New features
- `fix(scope): description` - Bug fixes
- `refactor(scope): description` - Code refactoring
- `test(scope): description` - Test changes
- `docs(scope): description` - Documentation
- `chore(scope): description` - Maintenance

Examples:
- `feat(tools): add service dependencies tool`
- `fix(clients): handle 429 rate limit errors`
- `test(integration): add end-to-end server tests`

## Common Issues

### SDK mocks not working

Ensure mocks are imported before clients in test files:

```javascript
import { mockDatadogApi } from "#test/mocks/datadogApi.js";
import { MetricsClient } from "#clients/metricsClient.js";
```

The mock must be hoisted via `vi.hoisted()` - see `test/mocks/datadogApi.js`.

### Tools not appearing in MCP client

1. Check tool is registered in `src/index.js` `registerTools()`
2. Verify tool definition has required fields (name, description, inputSchema)
3. Check server startup logs for "Registered tool: <name>"
4. Restart MCP client after server changes

### Type checking

JSDoc types are validated via `jsconfig.json` with `"checkJs": true`. IDEs like VS Code will show type errors inline.

## References

- [Datadog API Docs](https://docs.datadoghq.com/api/)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Datadog API Client SDK](https://github.com/DataDog/datadog-api-client-typescript)
