const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "unit-test-secret";

const mongoose = require("mongoose");
const multer = require("multer");
const bcrypt = require("bcryptjs");

const ApiError = require("../utils/apiError");
const {
  assertObjectId,
  isValidId,
  pick,
  requireFields,
  parseIntInRange,
  normalizeEmail,
} = require("../utils/helpers");
const { buildProductQuery } = require("../utils/query");
const { generateToken, verifyToken } = require("../utils/jwtToken");
const { generateRefreshToken } = require("../utils/refreshToken");
const { translateError, errorHandler } = require("../middleware/errorHandler");
const config = require("../config/env");

const User = require("../models/user-model/userModel");
const Product = require("../models/product-model/productModel");
const Blog = require("../models/blog-model/blogModel");
const Color = require("../models/color-model/colorModel");
const Order = require("../models/order-model/orderModel");
const { ORDER_STATUSES } = require("../models/order-model/orderModel");
const cloudinaryUtil = require("../utils/cloudinary");

const runPreSaveHooks = (doc) =>
  new Promise((resolve, reject) =>
    doc.$__schema.s.hooks.execPre("save", doc, (error) =>
      error ? reject(error) : resolve()
    )
  );

test("ApiError factories carry the right status codes", () => {
  assert.equal(ApiError.badRequest().statusCode, 400);
  assert.equal(ApiError.unauthorized().statusCode, 401);
  assert.equal(ApiError.forbidden().statusCode, 403);
  assert.equal(ApiError.notFound().statusCode, 404);
  assert.equal(ApiError.conflict().statusCode, 409);
  assert.equal(ApiError.badGateway().statusCode, 502);
});

test("helpers validate ids, whitelist fields and bound integers", () => {
  const id = new mongoose.Types.ObjectId().toString();
  assert.equal(isValidId(id), true);
  assert.equal(assertObjectId(id), id);
  assert.throws(() => assertObjectId("save-address"), /Invalid/);

  assert.deepEqual(
    pick({ title: "Shoe", price: 10, role: "admin", empty: undefined }, ["title", "price", "role"]),
    { title: "Shoe", price: 10, role: "admin" }
  );
  assert.deepEqual(pick({ a: 1 }, []), {});
  assert.throws(() => requireFields({ title: "x" }, ["title", "price"]), /price/);
  assert.equal(parseIntInRange(undefined, { field: "page", defaultValue: 1 }), 1);
  assert.throws(() => parseIntInRange("nope", { field: "page", defaultValue: 1 }), /page/);
  assert.throws(() => parseIntInRange(0, { field: "page", defaultValue: 1 }), /page/);
  assert.equal(normalizeEmail("  USER@Example.COM "), "user@example.com");
});

test("buildProductQuery builds safe filters and pagination defaults", () => {
  const defaults = buildProductQuery({});
  assert.deepEqual(defaults.filter, {});
  assert.equal(defaults.page, 1);
  assert.equal(defaults.limit, 12);
  assert.equal(defaults.skip, 0);
  assert.equal(defaults.sort, "-createdAt");

  // Express (qs parser) turns ?price[gte]=10 into { price: { gte: '10' } }.
  const built = buildProductQuery({
    price: { gte: "10" },
    category: "shoes",
    sort: "-price,title",
    fields: "title,price",
    page: "2",
    limit: "5",
  });
  assert.deepEqual(built.filter.price, { $gte: 10 });
  assert.equal(built.filter.category, "shoes");
  assert.equal(built.sort, "-price title");
  assert.equal(built.fields, "title price");
  assert.equal(built.skip, 5);
  assert.equal(built.limit, 5);

  assert.throws(() => buildProductQuery({ $where: "1" }), /Invalid filter/);
  assert.throws(() => buildProductQuery({ unknown: "1" }), /Unknown filter/);
  assert.throws(() => buildProductQuery({ price: { regex: "x" } }), /Unsupported filter/);
  assert.throws(() => buildProductQuery({ page: "0" }), /page/);
  assert.throws(() => buildProductQuery({ limit: "1000" }), /limit/);
});

test("access and refresh tokens are signed with the configured secret", () => {
  const id = new mongoose.Types.ObjectId().toString();
  const decoded = verifyToken(generateToken(id));
  assert.equal(decoded.id, id);
  assert.equal(
    require("jsonwebtoken").verify(generateRefreshToken(id), config.jwt_secret).id,
    id
  );
  assert.throws(() => verifyToken("not-a-token"));
});

test("user model: save hook only hashes modified passwords", async () => {
  const hash = await bcrypt.hash("secret", 10);
  const doc = User.hydrate({
    _id: new mongoose.Types.ObjectId(),
    firstName: "A",
    lastName: "B",
    email: "a@b.com",
    mobile: "123",
    password: hash,
  });

  // Regression: the old hook forgot `return next()` and re-hashed every save,
  // permanently locking the user out.
  await runPreSaveHooks(doc);
  assert.equal(doc.password, hash);
  assert.equal(await doc.isPasswordMatched("secret"), true);
  assert.equal(await doc.isPasswordMatched("wrong"), false);

  doc.password = "new-secret";
  await runPreSaveHooks(doc);
  assert.notEqual(doc.password, "new-secret");
  assert.equal(await doc.isPasswordMatched("new-secret"), true);
  assert.ok(doc.passwordChangedAt instanceof Date || typeof doc.passwordChangedAt === "number");
});

test("user model: toJSON never serialises credentials", () => {
  const doc = new User({
    firstName: "A",
    lastName: "B",
    email: "a@b.com",
    mobile: "123",
    password: "hashed",
    refreshToken: "refresh",
    passwordResetToken: "reset",
  });
  const json = doc.toJSON();
  for (const key of ["password", "refreshToken", "passwordResetToken", "passwordResetExpires"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(json, key), false, `${key} leaked`);
  }
});

test("user model: password reset token expires in 10 minutes", () => {
  const doc = new User({
    firstName: "A", lastName: "B", email: "a@b.com", mobile: "1", password: "hashed",
  });
  const token = doc.createPasswordResetToken();
  assert.match(token, /^[a-f0-9]{64}$/);
  const expected = require("crypto").createHash("sha256").update(token).digest("hex");
  assert.equal(doc.passwordResetToken, expected);
  const remaining = new Date(doc.passwordResetExpires).getTime() - Date.now();
  assert.ok(remaining > 9 * 60 * 1000 && remaining <= 10 * 60 * 1000);
});

test("models: schema option and field type mistakes are fixed", () => {
  assert.equal(Product.schema.path("totalrating").instance, "Number");
  assert.ok(Product.schema.path("ratings").schema.path("postedby"));
  assert.equal(Blog.schema.options.timestamps, true);
  assert.equal(Blog.schema.path("images").instance, "Array");
  assert.equal(Color.schema.options.timestamps, true);
  assert.equal(typeof Order.schema.path("paidAt").default, "function");
  assert.ok(ORDER_STATUSES.includes("Delivered"));
});

test("cloudinary util exports the alias the controllers used to import", () => {
  assert.equal(typeof cloudinaryUtil.cloudinaryUploadImg, "function");
  assert.equal(typeof cloudinaryUtil.cloudinaryDeleteImg, "function");
  assert.equal(cloudinaryUtil.cloudinaryUploads, cloudinaryUtil.cloudinaryUploadImg);
});

test("error handler maps Mongoose / multer / duplicate errors", () => {
  assert.equal(
    translateError(new mongoose.Error.CastError("ObjectId", "abc", "_id")).statusCode,
    400
  );
  const validationError = new mongoose.Error.ValidationError();
  validationError.errors = { title: { message: "title is required" } };
  assert.equal(translateError(validationError).message, "title is required");
  assert.equal(translateError({ code: 11000, keyPattern: { email: 1 } }).statusCode, 409);
  assert.equal(translateError(new multer.MulterError("LIMIT_FILE_SIZE")).statusCode, 413);
  assert.equal(translateError(ApiError.notFound("x")).statusCode, 404);
  assert.equal(translateError(new Error("unknown")), null);
});

test("error handler hides stack traces in production", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const originalError = console.error;
  console.error = () => {};
  try {
    let sent;
    const res = {
      status(code) { sent = { code }; return this; },
      json(body) { sent.body = body; return this; },
    };
    errorHandler(new Error("secret internals"), { method: "GET", originalUrl: "/x" }, res, () => {});
    assert.equal(sent.code, 500);
    assert.equal(sent.body.message, "Internal server error");
    assert.equal(sent.body.stack, undefined);
  } finally {
    console.error = originalError;
    process.env.NODE_ENV = previous;
  }
});
