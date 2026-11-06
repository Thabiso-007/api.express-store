const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");

const User = require("../models/user-model/userModel");
const config = require("../config/env");
const ApiError = require("../utils/apiError");
const { isValidId } = require("../utils/helpers");

/**
 * Verify the Bearer access token, load the user and attach it to req.user.
 * Rejects blocked users and tokens issued before a password change.
 */
const authMiddleWare = asyncHandler(async (req, res, next) => {
  const header = req.headers?.authorization || "";
  const [scheme, token] = header.trim().split(/\s+/);

  if (scheme !== "Bearer" || !token) {
    throw ApiError.unauthorized("There is no token attached to the header!");
  }
  if (!config.jwt_secret) {
    throw new ApiError(500, "JWT_SECRET is not configured");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt_secret);
  } catch {
    throw ApiError.unauthorized("Not authorised, token expired. Login again!!");
  }

  if (!decoded?.id || !isValidId(decoded.id)) {
    throw ApiError.unauthorized("Invalid token payload");
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw ApiError.unauthorized("The user belonging to this token no longer exists");
  }
  if (user.isBlocked) {
    throw ApiError.forbidden("This account has been blocked");
  }
  if (
    user.passwordChangedAt &&
    decoded.iat &&
    decoded.iat < Math.floor(new Date(user.passwordChangedAt).getTime() / 1000)
  ) {
    throw ApiError.unauthorized("Password changed recently. Please log in again.");
  }

  req.user = user;
  next();
});

const isAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw ApiError.unauthorized("Authentication required");
  }
  if (req.user.role !== "admin") {
    throw ApiError.forbidden("You are not an admin");
  }
  next();
});

module.exports = {
  authMiddleWare,
  // Correctly-spelled alias for new code.
  authMiddleware: authMiddleWare,
  isAdmin,
};
