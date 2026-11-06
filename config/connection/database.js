const mongoose = require("mongoose");

const config = require("../env");

let connectionPromise = null;

/**
 * Connect to MongoDB. The promise is memoised so serverless invocations that
 * reuse the same process do not open a new connection on every request.
 */
const dbConnection = async () => {
  // Avoid unknown-field queries being silently dropped (and the Mongoose 6
  // deprecation warning) regardless of which entry point loaded the models.
  mongoose.set("strictQuery", false);

  if (!config.db_connection) {
    throw new Error(
      "MONGO_URI is not configured. Set it in your .env file (see .env.example)."
    );
  }

  // Mongoose keeps a single connection per process; 1 = connected.
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(config.db_connection, {
        serverSelectionTimeoutMS: 10000,
      })
      .then((conn) => {
        console.log(`Database connected: ${conn.connection.host}`);
        return conn.connection;
      })
      .catch((error) => {
        connectionPromise = null; // allow a later retry
        console.error(`Database not connected: ${error.message}`);
        throw error;
      });
  }

  return connectionPromise;
};

const disconnect = async () => {
  connectionPromise = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

module.exports = dbConnection;
module.exports.dbConnection = dbConnection;
module.exports.disconnect = disconnect;
