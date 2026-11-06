const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "controllers-test-secret";
process.env.APP_URL = "https://shop.example.com";
process.env.CLOUD_NAME = "test-cloud";
process.env.CLOUD_API_KEY = "test-key";
process.env.CLOUD_API_SECRET = "test-secret";

const request = require("supertest");
const cloudinary = require("cloudinary").v2;

const app = require("../app");
const { stub, stubQuery, authenticate, objectId, makeUser } = require("./support");
const { generateToken } = require("../utils/jwtToken");
const User = require("../models/user-model/userModel");
const Product = require("../models/product-model/productModel");
const Blog = require("../models/blog-model/blogModel");
const Cart = require("../models/cart-model/cartModel");
const Coupon = require("../models/coupon-model/couponModel");
const Order = require("../models/order-model/orderModel");

// ---------------------------------------------------------------- auth -----
test("login awaits the password comparison (wrong password is rejected)", async (t) => {
  const found = makeUser({
    isPasswordMatched: async (password) => password === "correct-password",
  });
  stubQuery(t, User, "findOne", () => found);
  const updates = [];
  stub(t, User, "findByIdAndUpdate", async (...args) => {
    updates.push(args);
    return found;
  });

  const wrong = await request(app)
    .post("/api/user/login")
    .send({ email: "test@example.com", password: "wrong" });
  assert.equal(wrong.status, 401);

  const ok = await request(app)
    .post("/api/user/login")
    .send({ email: "test@example.com", password: "correct-password" });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.ok(ok.body.token);
  assert.equal(ok.body.password, undefined);
  assert.ok(ok.headers["set-cookie"].some((c) => c.startsWith("refreshToken=")));
  assert.equal(updates.length, 1);
  assert.match(updates[0][1].refreshToken, /^[\w-]+\.[\w-]+\.[\w-]+$/);
});

test("admin login handles unknown emails and non-admin users", async (t) => {
  let found = null;
  stubQuery(t, User, "findOne", () => found);
  stub(t, User, "findByIdAndUpdate", async () => ({}));

  const unknown = await request(app)
    .post("/api/user/admin-login")
    .send({ email: "nobody@example.com", password: "whatever" });
  assert.equal(unknown.status, 401); // old code dereferenced null -> 500

  found = makeUser({ role: "user" });
  const notAdmin = await request(app)
    .post("/api/user/admin-login")
    .send({ email: "test@example.com", password: "correct-password" });
  assert.equal(notAdmin.status, 403);
});

test("register whitelists fields and normalises the email", async (t) => {
  stubQuery(t, User, "findOne", () => null);
  const creates = [];
  stub(t, User, "create", async (payload) => {
    creates.push(payload);
    return { _id: objectId(), firstName: payload.firstName };
  });

  const res = await request(app).post("/api/user/register").send({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "  ADA@Example.COM ",
    mobile: " 123 ",
    password: "secret123",
    role: "admin",
    isBlocked: true,
    wishlist: ["hack"],
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(creates[0].email, "ada@example.com");
  assert.equal(creates[0].mobile, "123");
  for (const forbidden of ["role", "isBlocked", "wishlist", "refreshToken"]) {
    assert.equal(forbidden in creates[0], false, `${forbidden} was mass-assigned`);
  }
});

test("register rejects duplicate accounts with 409", async (t) => {
  stubQuery(t, User, "findOne", () => makeUser());
  const res = await request(app).post("/api/user/register").send({
    firstName: "A", lastName: "B", email: "a@b.com", mobile: "1", password: "secret123",
  });
  assert.equal(res.status, 409);
});

test("refresh token sends exactly one response and validates the payload", async (t) => {
  const id = objectId();
  const token = generateToken(id);
  let found = { _id: id };
  stubQuery(t, User, "findOne", () => found);

  const noCookie = await request(app).get("/api/user/refresh");
  assert.equal(noCookie.status, 401);

  const ok = await request(app).get("/api/user/refresh").set("Cookie", `refreshToken=${token}`);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.ok(ok.body.accessToken);

  found = { _id: objectId() }; // token belongs to a different user
  const mismatch = await request(app)
    .get("/api/user/refresh")
    .set("Cookie", `refreshToken=${token}`);
  assert.equal(mismatch.status, 403); // old code responded twice -> ERR_HTTP_HEADERS_SENT
});

test("logout clears the refresh token with a proper filter", async (t) => {
  const updates = [];
  stub(t, User, "updateOne", async (...args) => {
    updates.push(args);
    return { acknowledged: true };
  });
  const res = await request(app)
    .get("/api/user/logout")
    .set("Cookie", "refreshToken=some.token.value");
  assert.equal(res.status, 204);
  assert.deepEqual(updates[0][0], { refreshToken: "some.token.value" });
  assert.deepEqual(updates[0][1], { $unset: { refreshToken: 1 } });
  const setCookie = res.headers["set-cookie"][0];
  assert.ok(setCookie.includes("refreshToken=;"));
  assert.ok(setCookie.includes("Expires=Thu, 01 Jan 1970"), "cookie was not expired");
  assert.equal(setCookie.includes("Max-Age=86400"), false);
});

test("password reset returns 400 for an expired token instead of crashing", async (t) => {
  stubQuery(t, User, "findOne", () => null);
  const res = await request(app)
    .put("/api/user/reset-password/badtoken")
    .send({ password: "new-password" });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test("password reset clears the token and saves the new password", async (t) => {
  const doc = {
    password: "old-hash",
    passwordResetToken: "hashed",
    passwordResetExpires: new Date(Date.now() + 10000),
    save: async () => doc,
  };
  stubQuery(t, User, "findOne", () => doc);
  const res = await request(app)
    .put("/api/user/reset-password/rawtoken")
    .send({ password: "brand-new" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(doc.password, "brand-new");
  assert.equal(doc.passwordResetToken, undefined);
  assert.equal(doc.passwordResetExpires, undefined);
});

test("forgot-password never returns the reset token in the response", async (t) => {
  const doc = {
    createPasswordResetToken: () => "raw-reset-token",
    save: async () => doc,
  };
  const lookups = stubQuery(t, User, "findOne", () => doc);
  const res = await request(app)
    .post("/api/user/forgot-password-token")
    .send({ email: "TEST@Example.com" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.token, undefined);
  assert.equal(JSON.stringify(res.body).includes("raw-reset-token"), false);
  assert.deepEqual(lookups[0][0], { email: "test@example.com" });
});

test("updateRole targets :id, not the admin making the request", async (t) => {
  const { token, user } = authenticate(t, { role: "admin" });
  const targetId = objectId();
  const calls = stubQuery(t, User, "findByIdAndUpdate", (id, payload) => ({ _id: id, ...payload }));
  const res = await request(app)
    .put(`/api/user/role/${targetId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ role: "admin" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(String(calls[0][0]), String(targetId));
  assert.notEqual(String(calls[0][0]), String(user._id));
});

test("PUT /api/user/:id honours the id and enforces ownership", async (t) => {
  const { token, user } = authenticate(t, { role: "user" });
  const otherId = objectId();
  const calls = stubQuery(t, User, "findByIdAndUpdate", (id, payload) => ({
    _id: id,
    ...payload,
  }));

  const forbidden = await request(app)
    .put(`/api/user/${otherId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ firstName: "Hacked" });
  assert.equal(forbidden.status, 403);
  assert.equal(calls.length, 0);

  const own = await request(app)
    .put(`/api/user/${user._id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ firstName: "Ada" });
  assert.equal(own.status, 200, JSON.stringify(own.body));
  assert.equal(String(calls[0][0]), String(user._id));
  assert.deepEqual(calls[0][1], { firstName: "Ada" });
});

test("getWishList populates the correct schema field", async (t) => {
  const { token, user } = authenticate(t);
  let chain = [];
  const query = Promise.resolve({ _id: user._id, wishlist: [{ title: "Shoe" }] });
  for (const method of ["select", "populate", "sort", "limit", "skip", "lean"]) {
    query[method] = (...args) => {
      chain.push([method, ...args]);
      return query;
    };
  }
  stub(t, User, "findById", () => query);
  const res = await request(app)
    .get("/api/user/wishlist")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(chain.some(([method, field]) => method === "populate" && field === "wishlist"));
});

// ------------------------------------------------------------- products ----
test("rating uses the postedby field and stores a numeric average", async (t) => {
  const { token, user } = authenticate(t);
  const prodId = objectId();
  stubQuery(t, Product, "findById", () => ({
    _id: prodId,
    ratings: [
      { star: 1, comment: "bad", postedby: objectId() },
      { star: 2, comment: "old", postedby: user._id },
    ],
  }));
  const calls = stubQuery(t, Product, "findByIdAndUpdate", (id, payload) => ({
    _id: id,
    ...payload,
  }));

  const res = await request(app)
    .put("/api/product/rating")
    .set("Authorization", `Bearer ${token}`)
    .send({ star: 5, prodId: String(prodId), comment: "great" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const payload = calls[0][1];
  assert.equal(payload.ratings.length, 2);
  assert.equal(payload.ratings[1].star, 5);
  assert.equal(payload.totalrating, 3); // (1 + 5) / 2
  assert.equal(typeof payload.totalrating, "number");
});

test("rating rejects out-of-range stars", async (t) => {
  const { token } = authenticate(t);
  const res = await request(app)
    .put("/api/product/rating")
    .set("Authorization", `Bearer ${token}`)
    .send({ star: 9, prodId: String(objectId()) });
  assert.equal(res.status, 400);
});

test("updateProduct uses findByIdAndUpdate and regenerates the slug", async (t) => {
  const { token } = authenticate(t, { role: "admin" });
  stubQuery(t, Product, "findOne", () => null);
  const calls = stubQuery(t, Product, "findByIdAndUpdate", (id, payload) => ({
    _id: id,
    ...payload,
  }));
  const id = objectId();
  const res = await request(app)
    .put(`/api/product/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Brand New Shoe" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(String(calls[0][0]), String(id));
  assert.equal(calls[0][1].slug, "brand-new-shoe");
});

test("getAllProducts applies pagination and reports the total count", async (t) => {
  stub(t, Product, "countDocuments", async () => 25);
  const calls = [];
  const query = Promise.resolve([{ title: "Shoe" }]);
  for (const method of ["sort", "select", "skip", "limit", "populate", "lean"]) {
    query[method] = (...args) => {
      calls.push([method, ...args]);
      return query;
    };
  }
  stub(t, Product, "find", () => query);

  const res = await request(app).get("/api/product/?page=2&limit=5&sort=-price");
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body, [{ title: "Shoe" }]);
  assert.equal(res.headers["x-total-count"], "25");
  assert.ok(calls.some(([m, v]) => m === "skip" && v === 5));
  assert.ok(calls.some(([m, v]) => m === "limit" && v === 5));
});

// ---------------------------------------------------------------- blogs ----
test("liking a blog is per-user, toggles, and sends one response", async (t) => {
  const { token, user } = authenticate(t);
  const blogId = objectId();
  let current = {
    _id: blogId,
    likes: [objectId()],
    dislikes: [],
    isLiked: true,
    isDisliked: false,
  };
  stubQuery(t, Blog, "findById", () => current);
  const calls = stubQuery(t, Blog, "findByIdAndUpdate", (id, payload) => ({
    _id: id,
    ...payload,
  }));

  const first = await request(app)
    .put("/api/blog/likes")
    .set("Authorization", `Bearer ${token}`)
    .send({ blogId: String(blogId) });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.likes.length, 2);
  assert.ok(first.body.likes.map(String).includes(String(user._id)));

  current = { ...current, ...calls[0][1] };
  const second = await request(app)
    .put("/api/blog/likes")
    .set("Authorization", `Bearer ${token}`)
    .send({ blogId: String(blogId) });
  assert.equal(second.status, 200);
  assert.equal(second.body.likes.length, 1);
  assert.equal(second.body.likes.map(String).includes(String(user._id)), false);
});

test("getBlog returns the view-incremented document", async (t) => {
  const id = objectId();
  const calls = stubQuery(t, Blog, "findByIdAndUpdate", (blogId, payload) => ({
    _id: blogId,
    numViews: 7,
    ...payload,
  }));
  const res = await request(app).get(`/api/blog/${id}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(calls[0][1], { $inc: { numViews: 1 } });
});

// ----------------------------------------------------------------- cart -----
test("getUserCart returns every cart line", async (t) => {
  const { token } = authenticate(t);
  stubQuery(t, Cart, "find", [
    { _id: objectId(), quantity: 1 },
    { _id: objectId(), quantity: 2 },
  ]);
  const res = await request(app)
    .get("/api/user/cart")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(Array.isArray(res.body), true);
  assert.equal(res.body.length, 2);
});

test("userCart reads the price from the database, not the request", async (t) => {
  const { token, user } = authenticate(t);
  const prodId = objectId();
  stubQuery(t, Product, "findById", () => ({ _id: prodId, price: 99, quantity: 10 }));
  const calls = stubQuery(t, Cart, "findOneAndUpdate", (filter, update) => ({
    ...filter,
    ...update.$set,
  }));
  const res = await request(app)
    .post("/api/user/cart")
    .set("Authorization", `Bearer ${token}`)
    .send({ productId: String(prodId), quantity: 2, price: 1 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.price, 99);
  assert.equal(calls[0][1].$set.price, 99);
  assert.equal(String(calls[0][0].userId), String(user._id));
});

test("cart quantity can be updated (findOne, not findOneOne)", async (t) => {
  const { token } = authenticate(t);
  const itemId = objectId();
  const item = {
    _id: itemId,
    quantity: 1,
    save: async function () { this.saved = true; return this; },
  };
  stubQuery(t, Cart, "findOne", () => item);
  const res = await request(app)
    .put(`/api/user/cart/${itemId}/3`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.quantity, 3);
  assert.equal(item.saved, true);
});

test("applyCoupon calculates the discount from cart contents", async (t) => {
  const { token } = authenticate(t);
  stubQuery(t, Coupon, "findOne", () => ({
    name: "SAVE10",
    discount: 10,
    expiry: new Date(Date.now() + 60000),
  }));
  stubQuery(t, Cart, "find", [
    { price: 20, quantity: 2 },
    { price: 10, quantity: 1 },
  ]);
  const res = await request(app)
    .post("/api/user/cart/apply-coupon")
    .set("Authorization", `Bearer ${token}`)
    .send({ coupon: "save10" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.cartTotal, 50);
  assert.equal(res.body.discountAmount, 5);
  assert.equal(res.body.totalAfterDiscount, 45);
});

test("createOrder recomputes prices server-side and updates stock", async (t) => {
  const { token, user } = authenticate(t);
  const p1 = objectId();
  const p2 = objectId();
  stubQuery(t, Product, "find", [
    { _id: p1, price: 10, quantity: 100, title: "A" },
    { _id: p2, price: 5, quantity: 100, title: "B" },
  ]);
  const creates = [];
  stub(t, Order, "create", async (payload) => {
    creates.push(payload);
    return { _id: objectId(), ...payload };
  });
  const bulk = [];
  stub(t, Product, "bulkWrite", async (ops) => { bulk.push(ops); return {}; });
  const deletes = [];
  stub(t, Cart, "deleteMany", async (filter) => { deletes.push(filter); return { deletedCount: 1 }; });

  const res = await request(app)
    .post("/api/user/cart/create-order")
    .set("Authorization", `Bearer ${token}`)
    .send({
      shippingInfo: {
        firstName: "A", lastName: "B", address: "1 Main", city: "JHB", state: "Gauteng", pincode: "2000",
      },
      orderItems: [
        { product: String(p1), quantity: 2, price: 1 },
        { product: String(p2), quantity: 1, price: 1 },
      ],
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const order = creates[0];
  assert.equal(order.totalPrice, 25);
  assert.equal(order.totalPriceAfterDiscount, 25);
  assert.equal(order.orderItems[0].price, 10);
  assert.equal(String(order.user), String(user._id));
  assert.equal(bulk.length, 1);
  assert.equal(deletes.length, 1);
});

test("createOrder refuses to oversell", async (t) => {
  const { token } = authenticate(t);
  const p1 = objectId();
  stubQuery(t, Product, "find", [{ _id: p1, price: 10, quantity: 1, title: "A" }]);
  const res = await request(app)
    .post("/api/user/cart/create-order")
    .set("Authorization", `Bearer ${token}`)
    .send({
      shippingInfo: {
        firstName: "A", lastName: "B", address: "1 Main", city: "JHB", state: "Gauteng", pincode: "2000",
      },
      orderItems: [{ product: String(p1), quantity: 5 }],
    });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /Insufficient stock/);
});

// -------------------------------------------------------------- uploads -----
test("product image uploads are persisted with $push", async (t) => {
  const { token } = authenticate(t, { role: "admin" });
  const id = objectId();
  stub(t, cloudinary.uploader, "upload_stream", (options, callback) => {
    const stream = new EventEmitter();
    stream.end = () =>
      callback(null, {
        secure_url: "https://cdn.example.com/image.jpg",
        asset_id: "asset-1",
        public_id: "express-store/products/image",
      });
    return stream;
  });
  stubQuery(t, Product, "findById", () => ({ _id: id }));
  const calls = stubQuery(t, Product, "findByIdAndUpdate", (productId, payload) => ({
    _id: productId,
    ...payload,
  }));

  const res = await request(app)
    .put(`/api/product/uploads/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .attach("images", Buffer.from("fake-jpeg-bytes"), "photo.jpg");
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const images = calls[0][1].$push.images.$each;
  assert.equal(images.length, 1);
  assert.equal(images[0].url, "https://cdn.example.com/image.jpg");
  assert.equal(images[0].public_id, "express-store/products/image");
});

test("image deletion supports public ids containing slashes", async (t) => {
  const { token } = authenticate(t, { role: "admin" });
  const calls = [];
  stub(t, cloudinary.uploader, "destroy", async (...args) => {
    calls.push(args);
    return { result: "ok" };
  });
  const res = await request(app)
    .delete("/api/uploads/delete-img/express-store/products/image")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(calls[0][0], "express-store/products/image");
});
