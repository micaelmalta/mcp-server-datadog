# Security Review – MCP Datadog Server

**Scope:** Trust boundaries (MCP tool input, environment, Datadog API), handling of secrets (API keys), logging, and input used in API queries.  
**Overall risk:** Low–Medium. No critical issues; a few medium items around input validation and logging.

---

## Summary

The server runs as an MCP process over stdio, loads Datadog API keys from environment variables, and forwards MCP tool arguments (filters, queries, IDs, etc.) to Datadog APIs. Trust boundaries are: (1) MCP caller (tool arguments), (2) environment (secrets), (3) Datadog API (outbound). Sensitive data flow is confined to env → clients → Datadog; keys are not logged or returned in tool responses. Main gaps: full error objects and stack traces in logs/console, and user-controlled input passed into Datadog query strings without validation/sanitization, which could enable query manipulation or injection-style behavior.

---

## Critical

- **None identified.**

---

## High

- **Full error object and stack in logs/console** – In `src/index.js` (line ~148), `console.error(\`Error calling tool ${name}:\`, error)`logs the full`error` object. In Node this typically includes message and stack trace (file paths, line numbers). Stack traces are information disclosure and, if an error ever carried sensitive data (e.g. due to a bug), it could be exposed.
  - **Remediation:** Log only `error.message` (and optionally a stable error code), or use a small helper that redacts known sensitive fields and omits stack in production. Reserve full error/stack for debug mode or structured logging with appropriate access controls.

---

## Medium

- **User-controlled input in metric query string** – In `src/tools/metricsTools.js`, the metric query is built as `` `${input.metricName}{${input.filter}}` ``. `input.filter` is user/LLM-controlled. A value like `env:prod}` or `x},other:value` can break or alter the intended query and may allow influencing Datadog metric query behavior.
  - **Remediation:** Validate/sanitize `filter` (e.g. restrict to allowed characters, disallow `}`, or escape/encode per Datadog metric syntax). Apply the same care to `metricName` if it can contain unsafe characters.

- **Log ID used in log filter query without validation** – In `src/clients/logsClient.js`, `getLogDetails(logId)` builds the filter as `` `@_id:${logId}` ``. `logId` is user-controlled (from MCP tool input). Special characters or Datadog query syntax in `logId` could change the meaning of the query (e.g. quote/escape sequences or `OR`/`AND`).
  - **Remediation:** Validate `logId` format (e.g. allow only alphanumeric and safe separators like `-`/`_` per Datadog log ID format) or escape/encode for use inside the query string per Datadog documentation.

- **Monitor ID interpolated into search query** – In `src/clients/monitorsClient.js`, `getMonitorGroups(monitorId)` uses `` `query: \`monitor_id:${monitorId}\`` ``. `monitorId` is from tool input. Non-numeric or malicious values could distort the query.
  - **Remediation:** Validate that `monitorId` is a numeric type or a string that matches a strict numeric/id pattern before interpolating into the query.

- **Event tags/query built from user input** – In `src/clients/eventsClient.js`, tags are used in query building (e.g. `` `tags:${tag}` `` and `` `tags.map((tag) => \`tags:${tag}\`).join(" AND ")` ``). Tags are ultimately user/LLM-controlled. Values containing `AND`, `OR`, or other query syntax could alter the intended filter.
  - **Remediation:** Validate or sanitize each tag (length, allowed character set, no embedded query operators) per Datadog event query syntax.

---

## Low / Info

- **Logger may persist sensitive data** – `src/utils/logger.js` appends `JSON.stringify(data)` to the log file. If any caller ever passes an object that contains secrets (e.g. config with API keys), they would be written to disk.
  - **Mitigation:** Ensure no caller passes config or secrets to `Logger.log`. Optionally add a small redaction step for known keys (e.g. `apiKey`, `appKey`, `password`) when serializing `data`.

- **Log file location and permissions** – Log path is `path.join(process.cwd(), "mcp_datadog.log")`. If the process runs in a shared or world-readable directory, the log could be read by others. `mcp_datadog.log` is in `.gitignore`, which is good.
  - **Mitigation:** Run the server from a dedicated directory with restricted permissions, or configure a log path in a private location (e.g. via env) and set file permissions appropriately.

- **No rate limiting on tool calls** – The server does not rate limit MCP tool invocations. A buggy or abusive client could cause many Datadog API calls and hit rate limits or quota.
  - **Mitigation:** Consider per-process or per-tool rate limiting or circuit breaking for production use; document that the process should be run in a controlled environment.

- **README MCP example shows env for keys** – The README shows passing `DATADOG_API_KEY` and `DATADOG_APP_KEY` in the MCP config `env` block. This is standard and appropriate; keys are not hardcoded.

---

## Positive Notes

- **Secrets from environment only** – API keys are loaded via `loadEnvironmentVariable` / `getConfiguration()` from `process.env`; no hardcoded keys.
- **`.env` and `.env.example`** – `.env` is in `.gitignore`; `.env.example` uses placeholders only.
- **URL/path construction** – `ServicesClient` uses `encodeURIComponent(options.serviceName)` for path segments and `URLSearchParams` for query parameters, reducing path/query injection risk.
- **No dangerous globals** – No use of `eval`, `new Function`, or `child_process` execution of user input.
- **Error messages in tools** – Tool responses use `error.message` only, not full error objects or stacks.
- **Logger.error** – Logs only `error?.message || error`, not full stack or arbitrary error properties.
- **Tool responses** – Returned content is built from API response data (e.g. limited metrics, summaries); client config and API keys are not included.

---

## Checklist

- [x] User-controlled input and trust boundaries identified (MCP args → tools → clients → Datadog).
- [x] Sensitive data flow considered (env → config → clients; not in responses or Logger today).
- [x] Authn/authz: no user-level auth; process-level trust (whoever runs the server has key access) – acceptable for MCP.
- [x] Findings include location, severity, and remediation.
- [x] No unfounded alarm; severity reflects practical risk (no direct RCE or key leak in current code).

---

## Remediations applied (2026-02-02)

| Finding                            | Remediation                                                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **High – full error in logs**      | `src/index.js`: tool and fatal error handlers now log only `error.message` (no full object or stack).                             |
| **Medium – metric filter**         | `src/tools/metricsTools.js`: filter must not contain `{` or `}`; metricName trimmed and validated.                                |
| **Medium – log ID**                | `src/clients/logsClient.js`: `getLogDetails` validates logId format (alphanumeric, hyphen, underscore; max 512 chars).            |
| **Medium – monitor ID**            | `src/clients/monitorsClient.js`: `getMonitorGroups` validates monitorId is a non-negative finite number.                          |
| **Medium – event tags**            | `src/clients/eventsClient.js`: `searchEventsByTags` validates each tag (no embedded `AND` / `OR`; max 256 chars).                 |
| **Low – Logger secrets**           | `src/utils/logger.js`: `Logger.log` redacts known keys (`apiKey`, `appKey`, `password`, `secret`, `token`) when serializing data. |
| **Low – log file / rate limiting** | `README.md`: added “Operational notes” (log file location, rate limiting).                                                        |
