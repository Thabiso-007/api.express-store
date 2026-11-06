const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "app-test-secret";

const request = require("supertest");

const app = require("../app");
const { stub, stubQuery, authenticate, objectId, makeUser } = require("./support");
const { generateToken } = require("../utils/jwtToken");
const User = require("../models/user-model/userModel");
const BlogCategory = require("../models/blog-catergory-model/blogCategoryModel");
const Category = require("../models/category-model/categoryModel");

test("root, health and 404 endpoints", async () => {
  const root = await request(app).get("/");
  assert.equal(root.status, 200);
  assert.equal(root.body.status, "running");

  const health = await request(app).get("/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.status, "ok");
  assert.equal(typeof health.body.database, "string");

  const missing = await request(app).get("/api/does-not-exist");
  assert.equal(missing.status, 404);
  assert.match(missing.body.message, /Cannot GET/);
});

test("auth middleware returns 401 for missing or invalid tokens", async () => {
  const noToken = await request(app).get("/api/user/cart");
  assert.equal(noToken.status, 401);
  assert.match(noToken.body.message, /no token/i);

  const badToken = await request(app)
    .get("/api/user/cart")
    .set("Authorization", "Bearer not.a.jwt");
  assert.equal(badToken.status, 401);

  const wrongScheme = await request(app)
    .get("/api/user/cart")
    .set("Authorization", "Token abc");
  assert.equal(wrongScheme.status, 401);
});

test("auth middleware rejects blocked users and unknown users", async (t) => {
  const id = objectId();
  const token = generateToken(id);
  let result = { ...makeUser({ _id: id }), isBlocked: true };
  stubQuery(t, User, "findById", () => result);

  const blocked = await request(app)
    .get("/api/user/cart")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(blocked.status, 403);

  result = null;
  const unknown = await request(app)
    .get("/api/user/cart")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(unknown.status, 401);
});

test("specific user routes are not shadowed by PUT /:id", async (t) => {
  const { token, user } = authenticate(t, {
    save: async () => user,
  });
  const calls = stubQuery(t, User, "findByIdAndUpdate", {
    _id: user._id,
    address: "1 Main St",
  });

  const address = await request(app)
    .put("/api/user/save-address")
    .set("Authorization", `Bearer ${token}`)
    .send({ address: "1 Main St" });
  assert.equal(address.status, 200, JSON.stringify(address.body));
  assert.deepEqual(calls[0][1], { address: "1 Main St" });

  const password = await request(app)
    .put("/api/user/update-password")
    .set("Authorization", `Bearer ${token}`)
    .send({ password: "new-password" });
  assert.equal(password.status, 200, JSON.stringify(password.body));
  assert.equal(password.body.message, "Password updated");
});

test("admin-only routes are protected", async (t) => {
  const userId = objectId();
  const adminId = objectId();
  const userToken = generateToken(userId);
  const adminToken = generateToken(adminId);
  stubQuery(t, User, "findById", (id) => ({
    ...makeUser({ _id: id }),
    role: String(id) === String(adminId) ? "admin" : "user",
  }));
  stubQuery(t, User, "find", []);

  const allUsers = await request(app)
    .get("/api/user/all")
    .set("Authorization", `Bearer ${userToken}`);
  assert.equal(allUsers.status, 403);

  const enquiries = await request(app)
    .get("/api/enquiry/")
    .set("Authorization", `Bearer ${userToken}`);
  assert.equal(enquiries.status, 403);

  const coupons = await request(app)
    .get("/api/coupon/")
    .set("Authorization", `Bearer ${userToken}`);
  assert.equal(coupons.status, 403);

  const anonymousEnquiries = await request(app).get("/api/enquiry/");
  assert.equal(anonymousEnquiries.status, 401);

  const adminAll = await request(app)
    .get("/api/user/all")
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(adminAll.status, 200);
});

test("blog category routes are mounted before blog /:id", async (t) => {
  stubQuery(t, BlogCategory, "find", [{ _id: objectId(), title: "News" }]);

  const all = await request(app).get("/api/blog/category/all");
  assert.equal(all.status, 200, JSON.stringify(all.body));
  assert.equal(all.body[0].title, "News");

  const root = await request(app).get("/api/blog/category");
  assert.equal(root.status, 200);
});

test("malformed ids and filters produce 400 instead of 500", async () => {
  const badId = await request(app).get("/api/product/not-an-object-id");
  assert.equal(badId.status, 400);

  const badFilter = await request(app).get("/api/product/?price[gte]=abc");
  assert.equal(badFilter.status, 400, JSON.stringify(badFilter.body));

  const unknownFilter = await request(app).get("/api/product/?hack=1");
  assert.equal(unknownFilter.status, 400);
});

test("missing fields are rejected before the database is touched", async (t) => {
  const { token } = authenticate(t, { role: "admin" });
  const create = await request(app)
    .post("/api/product/create")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Incomplete" });
  assert.equal(create.status, 400);
  assert.match(create.body.message, /Missing required field/);
});

test("duplicate key errors return 409", async (t) => {
  const { token } = authenticate(t, { role: "admin" });
  stub(t, Category, "create", async () => {
    const error = new Error("E11000 duplicate key");
    error.code = 11000;
    error.keyPattern = { title: 1 };
    throw error;
  });
  const res = await request(app)
    .post("/api/category/create")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Shoes" });
  assert.equal(res.status, 409);
  assert.match(res.body.message, /already exists/);
});
