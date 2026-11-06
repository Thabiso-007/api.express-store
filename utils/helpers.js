const mongoose = require("mongoose");
const ApiError = require("./apiError");

/**
 * True when `id` is a real 24-character hex ObjectId (or an ObjectId instance).
 * mongoose.isValidObjectId() also accepts arbitrary 12-character strings such
 * as "save-address", which should not be treated as ids.
 */
const isValidId = (id) => {
  if (id instanceof mongoose.Types.ObjectId) return true;
  const value = String(id ?? "");
  return /^[a-fA-F0-9]{24}$/.test(value) && mongoose.isValidObjectId(value);
};

/** Reject malformed ids early with a 400 instead of a Mongoose CastError/500. */
const assertObjectId = (id, label = "id") => {
  if (!isValidId(id)) {
    throw ApiError.badRequest(`Invalid ${label}`);
  }
  return String(id);
};

/** Whitelist request body keys (prevents mass assignment of role, price, etc.). */
const pick = (source = {}, keys = []) => {
  const result = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
};

/** Verify that all required fields are present and non-empty. */
const requireFields = (source = {}, fields = []) => {
  const missing = fields.filter(
    (field) =>
      source[field] === undefined ||
      source[field] === null ||
      source[field] === ""
  );
  if (missing.length) {
    throw ApiError.badRequest(`Missing required field(s): ${missing.join(", ")}`);
  }
  return source;
};

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : email;

const isEmail = (email) =>
  typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/** Parse an integer query/body parameter with sane bounds. */
const parseIntInRange = (value, { field, defaultValue, min = 1, max = Number.MAX_SAFE_INTEGER }) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number) || number < min || number > max) {
    throw ApiError.badRequest(
      `${field} must be an integer between ${min} and ${max}`
    );
  }
  return number;
};

const parseAmount = (value, field = "amount") => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw ApiError.badRequest(`${field} must be a positive number`);
  }
  return Math.round(number * 100) / 100;
};

const asId = (value) => (value === undefined || value === null ? null : String(value));

module.exports = {
  isValidId,
  assertObjectId,
  pick,
  requireFields,
  normalizeEmail,
  isEmail,
  parseIntInRange,
  parseAmount,
  asId,
};
