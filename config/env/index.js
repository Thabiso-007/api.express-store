/**
 * Centralised configuration.
 *
 * Values are read lazily (through getters) so that a test runner can set
 * process.env before the app is required, and so that changing an environment
 * variable at runtime is honoured.
 */
const read = (key, fallback = undefined) => {
  const value = process.env[key];
  return value === undefined || value === "" ? fallback : value;
};

const config = {
  get node_env() {
    return read("NODE_ENV", "development");
  },
  get isProduction() {
    return this.node_env === "production";
  },
  get isTest() {
    return this.node_env === "test";
  },
  get server_port() {
    return Number(read("PORT", 5000));
  },
  get db_connection() {
    return read("MONGO_URI");
  },
  get jwt_secret() {
    return read("JWT_SECRET");
  },
  get jwt_expires_in() {
    return read("JWT_EXPIRES_IN", "1h");
  },
  get refresh_token_expires_in() {
    return read("REFRESH_TOKEN_EXPIRES_IN", "1d");
  },
  get client_url() {
    return read("CLIENT_URL");
  },
  get app_url() {
    return read("APP_URL", this.client_url || "http://localhost:3000");
  },
  get api_base_url() {
    // Optional absolute URL advertised in the OpenAPI `servers` list.
    return read("API_BASE_URL", "/");
  },
  get healthcheck_url() {
    return read(
      "HEALTHCHECK_URL",
      `http://127.0.0.1:${this.server_port}/api/health/ready`
    );
  },
  get email_address() {
    return read("EMAIL_ADDRESS");
  },
  get email_password() {
    return read("EMAIL_PASSWORD");
  },
  get email_from() {
    return read("EMAIL_FROM", "Express Store <no-reply@example.com>");
  },
  get cloud_name() {
    return read("CLOUD_NAME");
  },
  get cloud_api_key() {
    return read("CLOUD_API_KEY");
  },
  get cloud_api_secret() {
    return read("CLOUD_API_SECRET");
  },
  get paypal_mode() {
    return read("PAYPAL_MODE", "sandbox");
  },
  get paypal_base() {
    return this.paypal_mode === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  },
  get paypal_client_id() {
    return read("PAYPAL_CLIENT_ID");
  },
  get paypal_client_secret() {
    return read("PAYPAL_CLIENT_SECRET");
  },
  get paypal_currency() {
    return read("PAYPAL_CURRENCY", "USD").toUpperCase();
  },
  get refresh_cookie_max_age() {
    // Keep the cookie lifetime in sync with the refresh token lifetime.
    return 24 * 60 * 60 * 1000;
  },
};

/** Fail fast with a readable message instead of a cryptic runtime error. */
const validateEnv = () => {
  const missing = [];
  if (!config.db_connection) missing.push("MONGO_URI");
  if (!config.jwt_secret) missing.push("JWT_SECRET");
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "See .env.example for the full list of configuration options."
    );
  }
  return true;
};

module.exports = config;
module.exports.validateEnv = validateEnv;
