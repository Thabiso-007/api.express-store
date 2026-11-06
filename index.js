require("dotenv").config();

const app = require("./app");
const config = require("./config/env");
const dbConnection = require("./config/connection/database");

const isServerless = Boolean(process.env.VERCEL);
const isDirectRun = require.main === module && !isServerless;

if (isDirectRun) {
  config.validateEnv();
}

// In a serverless function the connection is opened once per warm container.
// We deliberately do not block module initialisation on it.
if (config.db_connection || isDirectRun) {
  dbConnection().catch((error) => {
    console.error(`Database not connected: ${error.message}`);
    if (isDirectRun) process.exitCode = 1;
  });
}

if (isDirectRun) {
  const PORT = config.server_port;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is listening on port: ${PORT}`);
  });
}

// @vercel/node expects the Express app as the module export.
module.exports = app;
