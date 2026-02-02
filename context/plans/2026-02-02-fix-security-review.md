# Plan: Fix Security Review Findings

**Date:** 2026-02-02  
**Task:** Implement remediations from `docs/SECURITY_REVIEW.md`  
**Objective:** Address High, Medium, and Low findings to reduce information disclosure and input-injection risk.

---

## Approach

Fix findings in order: High → Medium → Low. Add minimal validation/sanitization and logging changes without changing public API contracts. Add tests for new validation where appropriate.

---

## Affected Files

| Priority | File | Change |
|----------|------|--------|
| High | `src/index.js` | Log only `error.message` (no full error object) |
| Medium | `src/tools/metricsTools.js` | Sanitize `filter` (disallow `}`), validate `metricName` |
| Medium | `src/clients/logsClient.js` | Validate `logId` format before use in query |
| Medium | `src/clients/monitorsClient.js` | Validate `monitorId` is numeric in `getMonitorGroups` |
| Medium | `src/clients/eventsClient.js` | Validate/sanitize tags (no embedded ` AND ` / ` OR `) |
| Low | `src/utils/logger.js` | Redact known secret keys when serializing `data` |
| Low | `README.md` or `docs/SECURITY_REVIEW.md` | Document log file location and rate-limiting note |

---

## Implementation Steps

1. **High – index.js**  
   In the tool call handler catch block, replace `console.error(..., error)` with logging only `error.message` (e.g. `console.error(\`Error calling tool ${name}: ${error.message}\`)`). Do not log `error.stack` or the full object.

2. **Medium – metricsTools.js**  
   - Before building the metric query string: if `input.filter` contains `}` or `{`, reject with a clear error or strip/escape per Datadog metric syntax (safest: reject invalid chars).  
   - Optionally validate `metricName` (e.g. allow alphanumeric, dots, underscores; reject empty).

3. **Medium – logsClient.js**  
   In `getLogDetails(logId)`: validate `logId` matches a safe pattern (e.g. alphanumeric, hyphen, underscore; typical Datadog log IDs). If invalid, return `{ data: null, error: DatadogClientError("Invalid log ID format") }` before building the filter.

4. **Medium – monitorsClient.js**  
   In `getMonitorGroups(monitorId)`: ensure `monitorId` is numeric (number or string that parses to a finite number). If not, return error before calling the API.

5. **Medium – eventsClient.js**  
   Where tags are used in query building: validate each tag (e.g. no substring ` AND ` or ` OR `, max length, allowed charset) or sanitize. Reject invalid tags with a clear error.

6. **Low – logger.js**  
   In `Logger.log`, when serializing `data` with `JSON.stringify`, redact known keys: `apiKey`, `appKey`, `password`, `secret`, `token` (replace value with `"[REDACTED]"`). Recursively handle nested objects.

7. **Low – Documentation**  
   In README or SECURITY_REVIEW: add a short note that the log file is written to `process.cwd()/mcp_datadog.log` and that the process should be run with appropriate permissions; mention that there is no rate limiting on tool calls and that the server should be run in a controlled environment.

---

## Edge Cases and Risks

- **Validation too strict:** Ensure allowed patterns match real Datadog IDs (e.g. log IDs may be alphanumeric with hyphens). Use per-Datadog-docs patterns if documented.
- **Backward compatibility:** Invalid input that previously “worked” (e.g. odd filter strings) may now return validation errors; document in commit/changelog.

---

## Testing Strategy

- Run full test suite (`npm test`) after each logical change.
- Add unit tests for new validation: invalid `logId`, invalid `monitorId`, invalid metric `filter` (e.g. contains `}`), invalid event tags. Use existing test patterns (e.g. `test/clients/logsClient.test.js`, `test/tools/metricsTools.test.js`).
- Ensure no regressions in existing client/tool tests.

---

## Approval

Plan is ready for review. Proceed to Execute after approval.
