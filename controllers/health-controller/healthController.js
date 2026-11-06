const asyncHandler = require("express-async-handler");

const {
  getDatabaseStatus,
  getServiceStatus,
  checkReadiness,
} = require("../../utils/health");

const noStore = (res) => res.set("Cache-Control", "no-store");

/** Liveness: the Node process is running and accepting requests. */
const live = (req, res) => {
  noStore(res).status(200).json({
    status: "ok",
    ...getServiceStatus(),
    checks: { process: "ok" },
  });
};

/**
 * Combined health view. Always 200 while the process is alive (backwards
 * compatible with the original endpoint) and includes the database state, so
 * a monitor can tell "API up, database down" apart from "API down".
 */
const health = (req, res) => {
  const database = getDatabaseStatus();
  noStore(res).status(200).json({
    status: "ok",
    ...getServiceStatus(),
    database: database.state,
    checks: { process: "ok", database },
  });
};

/** Readiness: 200 only when MongoDB is reachable, otherwise 503. */
const ready = asyncHandler(async (req, res) => {
  const { ready: isReady, database, error } = await checkReadiness();
  noStore(res).status(isReady ? 200 : 503).json({
    status: isReady ? "ready" : "unavailable",
    ...getServiceStatus(),
    checks: { process: "ok", database },
    ...(error ? { error } : {}),
  });
});

/** Human-readable, self-refreshing status page (no external assets). */
const statusPage = (req, res) => {
  noStore(res).type("html").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>API status | api.express-store</title>
<style>
  :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0b1120; color: #e2e8f0; padding: 2rem 1rem; }
  main { max-width: 760px; margin: 0 auto; }
  h1 { margin: 0 0 .25rem; font-size: 1.6rem; }
  .sub { color: #94a3b8; margin-bottom: 1.5rem; font-size: .9rem; }
  .card { background: #111c33; border: 1px solid #23304d; border-radius: 12px; padding: 1.1rem 1.25rem; margin-bottom: 1rem; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .label { color: #94a3b8; font-size: .85rem; }
  .value { font-size: 1.05rem; font-weight: 600; }
  .badge { padding: .25rem .7rem; border-radius: 999px; font-size: .78rem; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; }
  .up { background: #064e3b; color: #6ee7b7; }
  .down { background: #7f1d1d; color: #fecaca; }
  .warn { background: #78350f; color: #fcd34d; }
  .pending { background: #1e293b; color: #94a3b8; }
  .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: .75rem; margin-top: .8rem; }
  .meta div { font-size: .82rem; color: #94a3b8; }
  .meta strong { display: block; color: #e2e8f0; font-size: .95rem; font-weight: 600; margin-top: .15rem; word-break: break-word; }
  a { color: #7dd3fc; }
  .links { display: flex; flex-wrap: wrap; gap: .75rem 1.25rem; margin-top: 1.25rem; font-size: .9rem; }
  code { background: #0b1120; border: 1px solid #23304d; border-radius: 6px; padding: .15rem .4rem; font-size: .8rem; }
  pre { background: #0b1120; border: 1px solid #23304d; border-radius: 8px; padding: .8rem; overflow-x: auto; font-size: .78rem; color: #cbd5e1; }
  footer { color: #64748b; font-size: .78rem; margin-top: 1.5rem; }
</style>
</head>
<body>
<main>
  <h1>API status</h1>
  <p class="sub">api.express-store &middot; auto-refreshes every 5 seconds</p>

  <div class="card">
    <div class="row">
      <div><div class="label">Backend process</div><div class="value" id="process-state">Checking&hellip;</div></div>
      <span class="badge pending" id="process-badge">checking</span>
    </div>
    <div class="meta">
      <div>Version<strong id="version">&mdash;</strong></div>
      <div>Environment<strong id="environment">&mdash;</strong></div>
      <div>Uptime<strong id="uptime">&mdash;</strong></div>
      <div>Checked at<strong id="checked">&mdash;</strong></div>
    </div>
  </div>

  <div class="card">
    <div class="row">
      <div><div class="label">Database (readiness)</div><div class="value" id="db-state">Checking&hellip;</div></div>
      <span class="badge pending" id="db-badge">checking</span>
    </div>
    <div class="meta">
      <div>MongoDB state<strong id="db-detail">&mdash;</strong></div>
      <div>Host<strong id="db-host">&mdash;</strong></div>
      <div>Ping<strong id="db-ping">&mdash;</strong></div>
    </div>
  </div>

  <div class="card">
    <div class="label">Quick links</div>
    <div class="links">
      <a href="/api/docs">Swagger UI</a>
      <a href="/api/docs.json">OpenAPI JSON</a>
      <a href="/api/health">/api/health</a>
      <a href="/api/health/live">/api/health/live</a>
      <a href="/api/health/ready">/api/health/ready</a>
      <a href="/">/</a>
    </div>
  </div>

  <div class="card">
    <div class="label">Check from a terminal</div>
    <pre>curl -i HEALTH_URL
curl -i HEALTH_READY_URL   # 200 = ready, 503 = database down</pre>
    <div class="label" style="margin-top:.6rem">Or from this repo</div>
    <pre>npm run health</pre>
  </div>

  <footer>If this page does not load at all, the process is down. A green process badge with a red database badge means the API is up but MongoDB is unreachable.</footer>
</main>
<script>
  var HEALTH_URL = "/api/health/live";
  var HEALTH_READY_URL = "/api/health/ready";
  function badge(id, text, cls) {
    var el = document.getElementById(id);
    el.textContent = text;
    el.className = "badge " + cls;
  }
  function text(id, value) { document.getElementById(id).textContent = value == null ? "-" : String(value); }
  function uptime(seconds) {
    if (typeof seconds !== "number") return "-";
    var h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
    return (h ? h + "h " : "") + (m ? m + "m " : "") + s + "s";
  }
  async function refresh() {
    var liveOk = false;
    try {
      var r = await fetch(HEALTH_URL, { cache: "no-store" });
      var data = await r.json();
      liveOk = r.ok && data.status === "ok";
      text("process-state", liveOk ? "Running" : "Not responding correctly");
      badge("process-badge", liveOk ? "up" : "down", liveOk ? "up" : "down");
      text("version", data.version);
      text("environment", data.environment);
      text("uptime", uptime(data.uptime));
    } catch (e) {
      text("process-state", "Unreachable");
      badge("process-badge", "down", "down");
    }
    try {
      var rr = await fetch(HEALTH_READY_URL, { cache: "no-store" });
      var d = await rr.json();
      var db = d.checks && d.checks.database ? d.checks.database : {};
      var ready = rr.ok && d.status === "ready";
      text("db-state", ready ? "Connected" : (db.state === "connecting" ? "Connecting to MongoDB" : "Unavailable"));
      badge("db-badge", ready ? "up" : (db.state === "connecting" ? "connecting" : "down"), ready ? "up" : (db.state === "connecting" ? "warn" : "down"));
      text("db-detail", db.state);
      text("db-host", db.host);
      text("db-ping", db.ping);
    } catch (e) {
      text("db-state", "Unreachable");
      badge("db-badge", "down", "down");
    }
    text("checked", new Date().toLocaleTimeString());
  }
  refresh();
  setInterval(refresh, 5000);
</script>
</body>
</html>`);
};

module.exports = { live, health, ready, statusPage };
