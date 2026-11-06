const mongoose = require("mongoose");
const multer = require("multer");
const jwt = require("jsonwebtoken");

const config = require("../config/env");
const ApiError = require("../utils/apiError");

/** 404 for anything that did not match a route. */
const notFound = (req, res, next) => {
  next(ApiError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
};

const translateError = (err) => {
  if (err instanceof ApiError) return err;

  if (err instanceof multer.MulterError) {
    return new ApiError(
      err.code === "LIMIT_FILE_SIZE" ? 413 : 400,
      err.code === "LIMIT_FILE_SIZE"
        ? "Uploaded file is too large (max 5 MB)"
        : err.message
    );
  }
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((item) => item.message);
    return ApiError.badRequest(details.join("; "), details);
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    return ApiError.conflict(`${field} already exists`);
  }
  if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
    return ApiError.unauthorized("Invalid or expired token");
  }
  // express.json() throws this when the body is malformed JSON.
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return ApiError.badRequest("Malformed JSON body");
  }
  if (err?.message === "Unsupported file format") {
    return ApiError.badRequest(err.message);
  }
  return null;
};

/** Final Express error middleware. Must be registered AFTER all routes. */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const translated = translateError(err);
  const statusCode = translated?.statusCode || err?.statusCode || 500;
  const isServerError = statusCode >= 500;
  const message =
    translated?.message ||
    (isServerError && config.isProduction
      ? "Internal server error"
      : err?.message || "Internal server error");

  if (isServerError && !translated) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  res.status(statusCode).json({
    message,
    ...(translated?.details ? { details: translated.details } : {}),
    ...(!config.isProduction && err?.stack ? { stack: err.stack } : {}),
  });
};

module.exports = { errorHandler, notFound, translateError };
