const jwt = require("jsonwebtoken");
const config = require("../config/env");
const ApiError = require("./apiError");

const getSecret = () => {
  if (!config.jwt_secret) {
    throw new ApiError(500, "JWT_SECRET is not configured");
  }
  return config.jwt_secret;
};

const generateToken = (id) =>
  jwt.sign({ id: String(id) }, getSecret(), {
    expiresIn: config.jwt_expires_in,
  });

const verifyToken = (token) => jwt.verify(token, getSecret());

module.exports = { generateToken, verifyToken };
