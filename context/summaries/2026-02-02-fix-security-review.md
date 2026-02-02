# Summary: Fix Security Review Findings

**Date:** 2026-02-02  
**Plan:** `context/plans/2026-02-02-fix-security-review.md`  
**Branch:** `fix/security-review-remediations`

---

## What was done

Implemented remediations from `docs/SECURITY_REVIEW.md` (High, Medium, and Low findings).

### High

- **index.js** – Tool and fatal error handlers now log only `error?.message ?? String(error)` instead of the full error object (no stack or sensitive props in console).

### Medium

- **metricsTools.js** – Metric `filter` must not contain `{` or `}`; `metricName` is trimmed and validated. Invalid filter returns a clear error.
- **logsClient.js** – `getLogDetails(logId)` validates logId format: non-empty string, alphanumeric + hyphen + underscore, max 512 chars. Invalid format returns `DatadogClientError`.
- **monitorsClient.js** – `getMonitorGroups(monitorId)` validates monitorId is a non-negative finite number before building the query.
- **eventsClient.js** – `searchEventsByTags(tags)` validates each tag: non-empty, max 256 chars, must not contain ` AND ` or ` OR ` (reserved query syntax).

### Low

- **logger.js** – Added `redactSecrets(data)` and use it when serializing `data` in `Logger.log`. Redacts keys: `apiKey`, `appKey`, `password`, `secret`, `token` (recursive, case-insensitive key match).
- **README.md** – Added “Operational notes” (subsection 6): log file location (`mcp_datadog.log` in cwd) and that the server does not rate limit tool calls.
- **docs/SECURITY_REVIEW.md** – Added “Remediations applied (2026-02-02)” table referencing each fix.

### Tests

- Added test in `test/tools/metricsTools.test.js`: “should reject filter containing { or } (security)” to assert the new metric filter validation.
- Ran metrics + monitors client and tool tests: 153 tests pass (same set that passed before). No regressions in affected code paths.

---

## Files modified

| File | Change |
|------|--------|
| `src/index.js` | Log only error.message in tool and fatal handlers |
| `src/tools/metricsTools.js` | Validate metricName; reject filter with `{` or `}` |
| `src/clients/logsClient.js` | Validate logId format in getLogDetails |
| `src/clients/monitorsClient.js` | Validate monitorId numeric in getMonitorGroups |
| `src/clients/eventsClient.js` | Validate tags in searchEventsByTags |
| `src/utils/logger.js` | Redact known secret keys when logging data |
| `README.md` | Operational notes (log file, rate limiting) |
| `docs/SECURITY_REVIEW.md` | Remediations-applied table |
| `test/tools/metricsTools.test.js` | Test for filter `{`/`}` rejection |
| `context/plans/2026-02-02-fix-security-review.md` | Plan (new) |
| `context/summaries/2026-02-02-fix-security-review.md` | This summary (new) |

---

## Decisions and trade-offs

- **Log ID format:** Restricted to `[a-zA-Z0-9_-]+` and max 512 chars to match typical Datadog log IDs and avoid query injection. If Datadog allows other characters in the future, the pattern can be relaxed with escaping.
- **Event tags:** Reject tags containing ` AND ` or ` OR ` (case-insensitive) to prevent query manipulation. Length cap 256 to avoid abuse.
- **Logger redaction:** Only redacts known key names; does not redact arbitrary nested paths. Sufficient to avoid logging config objects that contain apiKey/appKey.

---

## Validation

- `npm test` for `test/clients/metricsClient.test.js`, `test/clients/monitorsClient.test.js`, `test/tools/metricsTools.test.js`, `test/tools/monitorsTools.test.js`: **153 passed**.
- New metric filter validation test: **36 tests** in metricsTools.test.js (all pass).
- Lint: ESLint fails with existing config error (`__esModule` in `.eslintrc.js`); not caused by this change.

---

## Known limitations

- Other client/tool test files (logs, events, apm, integration) still fail due to existing SDK mock gaps; they were not modified for this security fix.
- Lint must be fixed separately (ESLint config).

---

## Future work

- Consider relaxing logId validation if Datadog documents additional allowed characters.
- Optionally add unit tests for logsClient getLogDetails (invalid logId), monitorsClient getMonitorGroups (invalid id), eventsClient searchEventsByTags (invalid tags) once those suites use the SDK mock.
