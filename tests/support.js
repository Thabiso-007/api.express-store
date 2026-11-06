/**
 * Test helpers. Models are stubbed at the method level so the suite exercises
 * real routing / controller code without needing a MongoDB server.
 */
const mongoose = require("mongoose");

const User = require("../models/user-model/userModel");

/** Replace a property for the lifetime of a single test. */
const stub = (t, object, key, replacement) => {
  const original = object[key];
  object[key] = replacement;
  t.after(() => {
    object[key] = original;
  });
};

/**
 * A thenable that also exposes the Mongoose query chaining methods used by
 * the controllers, so `Model.find().select().populate()` works with stubs.
 */
const chainable = (value) => {
  const promise = Promise.resolve(value);
  for (const method of [
    "select",
    "sort",
    "skip",
    "limit",
    "populate",
    "lean",
    "setOptions",
    "where",
  ]) {
    promise[method] = () => promise;
  }
  return promise;
};

const stubQuery = (t, Model, method, value) => {
  const calls = [];
  stub(t, Model, method, (...args) => {
    calls.push(args);
    return chainable(typeof value === "function" ? value(...args) : value);
  });
  return calls;
};

const objectId = () => new mongoose.Types.ObjectId();

const makeUser = (overrides = {}) => ({
  _id: objectId(),
  firstName: "Test",
  lastName: "User",
  email: "test@example.com",
  mobile: "0000000000",
  role: "user",
  isBlocked: false,
  isPasswordMatched: async (password) => password === "correct-password",
  ...overrides,
});

/** Stub the auth middleware's User.findById lookup and return a valid token. */
const authenticate = (t, overrides = {}) => {
  const { generateToken } = require("../utils/jwtToken");
  const user = makeUser(overrides);
  const token = generateToken(user._id);
  stubQuery(t, User, "findById", user);
  return { user, token };
};

module.exports = { stub, stubQuery, chainable, objectId, makeUser, authenticate };
