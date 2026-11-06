const mongoose = require("mongoose");

const config = require("../config/env");
const pkg = require("../package.json");

const DB_STATES = ["disconnected", "connected", "connecting", "disconnecting"];
const DEFAULT_DB_PING_TIMEOUT_MS = 2000;

/** Resolve/reject a promise within a deadline, without leaking timers. */
const withTimeout = (promise, ms) => {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Database ping timed out")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

const getDatabaseStatus = () => {
  const connection = mongoose.connection;
  const readyState = connection.readyState;
  return {
    state: DB_STATES[readyState] || "unknown",
    readyState,
    connected: readyState === 1,
    host: connection.host || null,
    name: connection.name || null,
  };
};

const getServiceStatus = () => ({
  name: pkg.name,
  version: pkg.version,
  environment: config.node_env,
  uptime: Math.floor(process.uptime()),
  timestamp: new Date().toISOString(),
});

/**
 * Readiness = the process can serve useful traffic, i.e. MongoDB is reachable.
 * Liveness (`/api/health`, `/api/health/live`) only says the process is alive.
 */
const checkReadiness = async () => {
  const database = getDatabaseStatus();
  if (!database.connected) {
    return { ready: false, database };
  }

  // A stale connection can still report readyState === 1; a ping proves the
  // socket really works. Skip it when no native db handle exists (unit tests).
  if (!mongoose.connection.db?.admin) {
    return { ready: true, database };
  }
  try {
    await withTimeout(
      Promise.resolve(mongoose.connection.db.admin().ping()),
      DEFAULT_DB_PING_TIMEOUT_MS
    );
    database.ping = "ok";
    return { ready: true, database };
  } catch (error) {
    database.ping = "failed";
    return { ready: false, database, error: error.message };
  }
};

module.exports = {
  DB_STATES,
  getDatabaseStatus,
  getServiceStatus,
  checkReadiness,
  withTimeout,
};
