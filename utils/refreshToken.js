const jwt = require("jsonwebtoken");
const config = require("../config/env");
const ApiError = require("./apiError");

const generateRefreshToken = (id) => {
  if (!config.jwt_secret) {
    throw new ApiError(500, "JWT_SECRET is not configured");
  }
  return jwt.sign({ id: String(id) }, config.jwt_secret, {
    expiresIn: config.refresh_token_expires_in,
  });
};

module.exports = { generateRefreshToken };
