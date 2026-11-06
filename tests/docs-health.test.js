const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "docs-test-secret";

const request = require("supertest");
const mongoose = require("mongoose");
const SwaggerParser = require("@apidevtools/swagger-parser");

const app = require("../app");
const spec = require("../docs/openapi");
const healthUtils = require("../utils/health");

/** Shadow the prototype getter so readiness can be tested without Mongo. */
const stubDbState = (t, value) => {
  const connection = mongoose.connection;
  Object.defineProperty(connection, "readyState", {
    value,
    writable: true,
    configurable: true,
  });
  t.after(() => {
    delete connection.readyState;
  });
};

const stubDbHandle = (t, value) => {
  const connection = mongoose.connection;
  const hadOwn = Object.prototype.hasOwnProperty.call(connection, "db");
  const descriptor = Object.getOwnPropertyDescriptor(connection, "db");
  Object.defineProperty(connection, "db", { value, writable: true, configurable: true });
  t.after(() => {
    if (hadOwn) Object.defineProperty(connection, "db", descriptor);
    else delete connection.db;
  });
};

const walk = (value, visitor, seen = new Set()) => {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (typeof value.$ref === "string") visitor(value.$ref);
  for (const child of Object.values(value)) walk(child, visitor, seen);
};

const EXPECTED_PATHS = [
  "/", "/status", "/api/docs", "/api/docs.json",
  "/api/health", "/api/health/live", "/api/health/ready",
  "/api/user/register", "/api/user/login", "/api/user/admin-login",
  "/api/user/forgot-password-token", "/api/user/reset-password/{token}",
  "/api/user/refresh", "/api/user/logout",
  "/api/user/all", "/api/user/{id}", "/api/user/update-user",
  "/api/user/save-address", "/api/user/update-password", "/api/user/wishlist",
  "/api/user/role/{id}", "/api/user/blocked-user/{id}", "/api/user/unblocked-user/{id}",
  "/api/user/cart", "/api/user/cart/{cartItemId}/{newQuantity}",
  "/api/user/delete-product-cart/{cartItemId}", "/api/user/empty-cart",
  "/api/user/update-product-cart/{cartItemId}/{newQuantity}",
  "/api/user/cart/apply-coupon", "/api/user/cart/create-order",
  "/api/user/get-orders", "/api/user/all-orders", "/api/user/order/update-order/{id}",
  "/api/product", "/api/product/create", "/api/product/{id}",
  "/api/product/wishlist", "/api/product/rating", "/api/product/uploads/{id}",
  "/api/blog", "/api/blog/create", "/api/blog/likes", "/api/blog/dislikes",
  "/api/blog/uploads/{id}", "/api/blog/{id}",
  "/api/blog/category", "/api/blog/category/create", "/api/blog/category/all", "/api/blog/category/{id}",
  "/api/category", "/api/category/create", "/api/category/all", "/api/category/{id}",
  "/api/brand", "/api/brand/create", "/api/brand/all", "/api/brand/{id}",
  "/api/color", "/api/color/{id}",
  "/api/coupon", "/api/coupon/create", "/api/coupon/name/{name}", "/api/coupon/{id}",
  "/api/enquiry", "/api/enquiry/{id}",
  "/api/uploads", "/api/uploads/delete-img/{publicId}",
  "/api/orders", "/api/orders/{orderID}/capture",
];

test("OpenAPI document is served and is a valid 3.0 document", async () => {
  const res = await request(app).get("/api/docs.json");
  assert.equal(res.status, 200);
  assert.equal(res.body.openapi, "3.0.3");
  assert.equal(res.body.info.title, "api.express-store");
  assert.ok(Array.isArray(res.body.servers));
  assert.ok(res.body.components.securitySchemes.bearerAuth);
  assert.ok(res.body.components.securitySchemes.refreshCookie);
  assert.deepEqual(res.body, spec);
});

test("OpenAPI document passes the official OpenAPI 3 schema validator", async () => {
  const validated = await SwaggerParser.validate(JSON.parse(JSON.stringify(spec)));
  assert.equal(validated.openapi, "3.0.3");
  assert.ok(Object.keys(validated.paths).length >= EXPECTED_PATHS.length);
});

test("every documented path from the routers is present", () => {
  for (const routePath of EXPECTED_PATHS) {
    assert.ok(spec.paths[routePath], `Missing docs for ${routePath}`);
  }
  assert.ok(Object.keys(spec.paths).length >= EXPECTED_PATHS.length);
});

test("all $ref pointers resolve to real components", () => {
  const targets = new Set();
  walk(spec, (reference) => targets.add(reference));
  assert.ok(targets.size > 40, "expected a well-linked spec");

  for (const reference of targets) {
    assert.ok(reference.startsWith("#/"), `Unexpected external ref ${reference}`);
    let node = spec;
    for (const segment of reference.slice(2).split("/")) {
      node = node?.[segment.replace(/~1/g, "/").replace(/~0/g, "~")];
    }
    assert.notEqual(node, undefined, `Broken $ref: ${reference}`);
  }
});

test("every operation has responses, known tags, declared path params and a unique id", () => {
  const tagNames = new Set(spec.tags.map((tag) => tag.name));
  const ids = new Set();
  const methods = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);

  for (const [routePath, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!methods.has(method)) continue;
      assert.ok(operation.responses && Object.keys(operation.responses).length > 0, `${method} ${routePath} has no responses`);
      assert.ok(operation.summary, `${method} ${routePath} has no summary`);
      for (const tag of operation.tags || []) {
        assert.ok(tagNames.has(tag), `Unknown tag ${tag}`);
      }
      assert.ok(!ids.has(operation.operationId), `Duplicate operationId ${operation.operationId}`);
      ids.add(operation.operationId);

      const declared = new Set(
        (operation.parameters || []).filter((p) => p.in === "path").map((p) => p.name)
      );
      for (const match of routePath.matchAll(/\{([^}]+)\}/g)) {
        assert.ok(declared.has(match[1]), `${routePath}: path parameter {${match[1]}} not declared`);
      }
    }
  }
  assert.ok(ids.size >= 90, `expected full coverage, got ${ids.size} operations`);
});

test("Swagger UI and its static assets are served locally", async () => {
  const redirect = await request(app).get("/api/docs");
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.location, "/api/docs/");

  const ui = await request(app).get("/api/docs/");
  assert.equal(ui.status, 200);
  assert.match(ui.headers["content-type"], /text\/html/);
  assert.match(ui.text, /swagger-ui/);
  assert.match(ui.text, /swagger-ui-init\.js/);

  // The spec is bundled locally (no CDN / external fetch from the browser).
  const init = await request(app).get("/api/docs/swagger-ui-init.js");
  assert.equal(init.status, 200);
  assert.match(init.text, /api\.express-store/);
  assert.match(init.text, /openapi/);

  const css = await request(app).get("/api/docs/swagger-ui.css");
  assert.equal(css.status, 200);
  assert.match(css.headers["content-type"], /css/);
});

test("status page is self-contained and uses relative URLs", async () => {
  const res = await request(app).get("/status");
  assert.equal(res.status, 200);
  assert.match(res.headers["content-type"], /text\/html/);
  assert.match(res.text, /API status/);
  assert.match(res.text, /\/api\/health\/ready/);
  assert.match(res.text, /setInterval/);
  assert.equal(res.text.includes("http://localhost"), false);
  assert.equal(res.text.includes("127.0.0.1"), false);
});

test("root response links to docs and health endpoints", async () => {
  const res = await request(app).get("/");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "running");
  assert.equal(res.body.docs, "/api/docs");
  assert.equal(res.body.openapi, "/api/docs.json");
  assert.equal(res.body.ready, "/api/health/ready");
  assert.equal(res.body.statusPage, "/status");
});

test("liveness always succeeds and is not cached", async () => {
  const live = await request(app).get("/api/health/live");
  assert.equal(live.status, 200);
  assert.equal(live.body.status, "ok");
  assert.equal(live.body.checks.process, "ok");
  assert.equal(live.headers["cache-control"], "no-store");
  assert.equal(typeof live.body.version, "string");
  assert.equal(typeof live.body.uptime, "number");

  const health = await request(app).get("/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.status, "ok");
  assert.equal(typeof health.body.database, "string"); // backwards compatible
  assert.equal(typeof health.body.checks.database.state, "string");
});

test("readiness returns 503 when MongoDB is not connected", async (t) => {
  stubDbState(t, 0); // nothing connects to Mongo in the test process
  const res = await request(app).get("/api/health/ready");
  assert.equal(res.status, 503);
  assert.equal(res.body.status, "unavailable");
  assert.equal(res.body.checks.database.connected, false);
  assert.equal(res.headers["cache-control"], "no-store");
});

test("readiness returns 200 when MongoDB is connected", async (t) => {
  stubDbState(t, 1);
  const res = await request(app).get("/api/health/ready");
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.status, "ready");
  assert.equal(res.body.checks.database.connected, true);
});

test("readiness fails when the database ping fails", async (t) => {
  stubDbState(t, 1);
  stubDbHandle(t, {
    admin: () => ({ ping: async () => { throw new Error("connection lost"); } }),
  });
  const res = await request(app).get("/api/health/ready");
  assert.equal(res.status, 503);
  assert.equal(res.body.checks.database.ping, "failed");
  assert.match(res.body.error, /connection lost/);
});

test("withTimeout rejects slow promises and clears its timer", async () => {
  const slow = new Promise(() => {});
  await assert.rejects(() => healthUtils.withTimeout(slow, 10), /timed out/);
  const fast = await healthUtils.withTimeout(Promise.resolve("done"), 100);
  assert.equal(fast, "done");
});

test("npm run health exits 0 when ready and 1 when down", async (t) => {
  const server = http.createServer((req, res) => {
    const ready = req.url === "/ready";
    res.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
    res.end(JSON.stringify(ready ? { status: "ready", checks: { database: { state: "connected" } } } : { status: "unavailable" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const port = server.address().port;
  const script = path.join(__dirname, "..", "scripts", "healthcheck.js");

  // Must be async: spawnSync would block this process's event loop, so the
  // local HTTP server could never answer the child's request.
  const run = (urlPath) =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, [script], {
        env: { ...process.env, HEALTHCHECK_URL: `http://127.0.0.1:${port}${urlPath}` },
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    });

  const up = await run("/ready");
  assert.equal(up.status, 0, up.stderr);
  assert.match(up.stdout, /UP/);

  const down = await run("/down");
  assert.equal(down.status, 1);
  assert.match(down.stderr, /DOWN/);
});
