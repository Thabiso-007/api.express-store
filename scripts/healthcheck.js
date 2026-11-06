#!/usr/bin/env node
/**
 * Standalone readiness probe for scripts, cron jobs, Docker/K8s healthchecks
 * and CI. Exits 0 when the API is ready, 1 otherwise.
 *
 *   npm run health
 *   HEALTHCHECK_URL=https://api.example.com/api/health/ready node scripts/healthcheck.js
 */
const config = require("../config/env");

const url = config.healthcheck_url;
const timeoutMs = Number(process.env.HEALTHCHECK_TIMEOUT_MS || 5000);

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);
timer.unref?.();

(async () => {
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));

    if (response.ok) {
      console.log(
        `UP: ${url} -> ${response.status} ${body.status || "ok"} ` +
          `(database: ${body.checks?.database?.state || "unknown"})`
      );
      process.exit(0);
    }
    console.error(
      `DOWN: ${url} -> ${response.status} ${body.status || ""} ` +
        `${body.message || body.error || ""}`.trim()
    );
    process.exit(1);
  } catch (error) {
    console.error(`DOWN: ${url} -> ${error.name === "AbortError" ? "timeout" : error.message}`);
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
})();
