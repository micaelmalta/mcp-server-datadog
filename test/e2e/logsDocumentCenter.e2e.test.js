/**
 * E2E test: document-center production error logs in the last 7 days.
 * Calls the MCP search_logs tool (same path as when an AI uses the MCP server).
 * Run with: RUN_E2E=1 npm run test:e2e
 *
 * Requires .env with real DATADOG_API_KEY and DATADOG_APP_KEY for the org
 * where document-center sends logs. Skipped when RUN_E2E is not set.
 */

import { describe, it, expect } from "vitest";
import { LogsClient } from "#clients/logsClient.js";
import { getLogsTools } from "#tools/logsTools.js";
import { getConfiguration } from "#utils/environment.js";

const runE2E =
  process.env.RUN_E2E === "1" &&
  process.env.DATADOG_API_KEY &&
  process.env.DATADOG_APP_KEY &&
  process.env.DATADOG_API_KEY !== "test-api-key";

function clientConfig() {
  const c = getConfiguration();
  return {
    apiKey: c.datadogApiKey,
    appKey: c.datadogAppKey,
    site: c.datadogSite,
  };
}

describe.skipIf(!runE2E)("E2E: document-center production error logs (via MCP)", () => {
  it("search_logs returns error logs for document-center in production in the last 7 days", async () => {
    const config = clientConfig();
    const client = new LogsClient(config);
    const tools = getLogsTools(client);
    const searchLogsTool = tools.find((t) => t.name === "search_logs");
    expect(searchLogsTool).toBeDefined();

    const toMs = Date.now();
    const fromMs = toMs - 7 * 24 * 60 * 60 * 1000;
    const filter = "service:document-center env:production status:error";

    const result = await searchLogsTool.handler({
      filter,
      from: fromMs,
      to: toMs,
      limit: 100,
    });

    expect(result.isError, result.content?.[0]?.text ?? "no content").toBe(false);
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);

    const text = result.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.logsCount).toBeDefined();
    expect(
      parsed.logsCount,
      "Expected at least one error log for document-center in production (last 7 days). " +
        "Check DATADOG_* keys and site point to the org where document-center sends logs."
    ).toBeGreaterThan(0);
  });
});
