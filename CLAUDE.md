# mcp_datadog - CLAUDE.md

Project-specific guidance for Claude Code when working with the MCP Datadog server.

## Project Overview

MCP Datadog is a Node.js/JavaScript Model Context Protocol server that integrates Datadog APIs with AI tools. It provides clients for metrics, logs, events, monitors, and APM/traces APIs.

## Tech Stack

- **Runtime**: Node.js 20.20.0+ (ES modules)
- **Language**: JavaScript with JSDoc type hints (NO TypeScript)
- **Framework**: @modelcontextprotocol/sdk
- **Testing**: Vitest
- **Linting**: ESLint + Prettier
- **Reference Projects**: hq-bff, cs-api (for Node.js patterns)

## Project Structure

```
mcp_datadog/
├── src/
│   ├── clients/          # Datadog API clients
│   │   ├── metricsClient.js
│   │   ├── logsClient.js
│   │   ├── eventsClient.js
│   │   ├── monitorsClient.js
│   │   └── apmClient.js
│   ├── tools/            # MCP tool handlers (to be added)
│   ├── utils/
│   │   ├── environment.js
│   │   ├── errors.js
│   │   └── apiClient.js
│   └── index.js          # Server entry point
├── test/
│   ├── fixtures/
│   │   └── datadogResponses.js
│   └── setup.js
├── docs/
├── package.json
├── jsconfig.json         # Path aliases
├── vitest.config.js
└── .eslintrc.js
```

## Key Patterns

### Path Aliases (jsconfig.json)

```javascript
import { ... } from "#utils/environment.js";
import { ... } from "#clients/metricsClient.js";
import { ... } from "#tools/...";
import { ... } from "#test/fixtures/...";
```

### Error Handling Pattern

All API methods return `{ data, error }` tuples:

```javascript
const { data, error } = await client.queryMetrics(query, from, to);
if (error) {
  // Handle error
}
```

### Custom Errors

- `DatadogClientError` - API failures, includes statusCode
- `MissingEnvironmentVariable` - Config errors
- `InvalidConfigurationError` - Config validation

### API Client Architecture

1. `ApiClient` base class in `src/utils/apiClient.js`
   - Generic HTTP client with fetch
   - Methods: `get()`, `post()`, `put()`
   - Error handling and timeouts

2. Domain-specific clients (Metrics, Logs, Events, etc.)
   - Extend functionality for specific APIs
   - Validate inputs
   - Return `{ data, error }` format

## Common Tasks

### Running Tests

```bash
npm test              # Run once
npm test:watch       # Watch mode
npm run test:coverage # With coverage
```

### Linting & Formatting

```bash
npm run lint         # Check
npm run lint:fix     # Fix issues
npm run format       # Format with Prettier
npm run validate     # All checks (lint + test)
```

### Adding a New Client

1. Create `src/clients/<domain>Client.js`
2. Import `ApiClient` and error classes
3. Implement methods following existing patterns
4. Add JSDoc comments for all methods
5. Use `{ data, error }` return pattern
6. Add test fixtures in `test/fixtures/`

### Adding a Tool Handler

1. Create `src/tools/<tool-name>.js`
2. Use corresponding client from `src/clients/`
3. Implement as MCP tool with proper schema
4. Add to `src/index.js` tool registry
5. Include error handling and validation

## Environment Configuration

Required variables (from .env):

- `DATADOG_API_KEY` - Datadog API key (required)
- `DATADOG_APP_KEY` - Datadog application key (required)
- `DATADOG_SITE` - Datadog site domain (default: datadoghq.com)
- `DATADOG_REGION` - Region for URLs (default: us1)
- `NODE_ENV` - Environment (default: local)
- `MCP_SERVER_NAME` - Server name (default: datadog)
- `MCP_SERVER_VERSION` - Server version (default: 1.0.0)

Load with `getConfiguration()` from `src/utils/environment.js`.

## Code Style

- **Line Length**: 100 characters max
- **Imports**: ES modules with path aliases
- **Comments**: JSDoc on all exported functions/classes
- **Variables**: Meaningful names, avoid single letters (except loops)
- **Error Messages**: Clear and actionable

### JSDoc Example

```javascript
/**
 * Query metrics data from Datadog.
 * @param {string} query - The metrics query
 * @param {number} from - Unix timestamp (seconds)
 * @param {number} to - Unix timestamp (seconds)
 * @returns {Promise<{data: Object, error: null} |
 *   {data: null, error: Error}>}
 */
async queryMetrics(query, from, to) {
  // ...
}
```

## Datadog API Integration

### Base URLs

- V1 API: `https://api.{site}/api/v1`
- V2 API: `https://api.{site}/api/v2`

### Authentication

All requests include headers:

```javascript
{
  "DD-API-KEY": apiKey,
  "DD-APPLICATION-KEY": appKey,
  "Content-Type": "application/json"
}
```

### Rate Limiting

Datadog APIs have rate limits. Implement backoff and error handling:

- Check for 429 status codes
- Respect Retry-After headers
- Log rate limit errors

## Testing

### Test Structure

```bash
npm run test           # Run all .test.js files
npm run test:watch    # Continuous mode
```

### Mock Data

Use fixtures from `test/fixtures/datadogResponses.js`:

```javascript
import { metricsQueryResponse } from "#test/fixtures/datadogResponses.js";
```

### Setup

`test/setup.js` initializes:

- Environment variables
- Global test configuration
- Cleanup hooks

## Git Conventions

- Conventional commits: `type(scope): description`
- Valid types: feat, fix, docs, chore, refactor, test, ci, perf
- Examples:
  - `feat(clients): add traces API support`
  - `fix(metricsClient): handle invalid time ranges`
  - `test(logsClient): add search validation tests`

## Deployment

This is an MCP server typically deployed as a subprocess. Ensure:

1. Environment variables are set
2. Dependencies installed (`npm install`)
3. Port/transport configuration
4. Process management (systemd, supervisord, Docker)

## Useful Commands

```bash
npm start              # Start server
npm run dev            # Dev mode with NODE_ENV=local
npm run validate       # Full validation before commit
npm run lint:fix       # Auto-fix style issues
```

## Common Issues

### Missing Environment Variables

Use `loadEnvironmentVariable()` for required vars. Throws `MissingEnvironmentVariable` with helpful message.

### API Client Timeouts

Default timeout: 30 seconds. Adjust in ApiClient constructor if needed:

```javascript
new ApiClient({ ..., timeout: 60000 })
```

### Type Checking

JSDoc types are checked by the IDE/editor. Run with:

```bash
# Via jsconfig.json "checkJs": true
```

## References

- Datadog API Docs: https://docs.datadoghq.com/api/
- MCP Specification: https://modelcontextprotocol.io/
- Similar Project: hq-bff/CLAUDE.md (for patterns)
- Similar Project: cs-api/CLAUDE.md (for Node.js patterns)
