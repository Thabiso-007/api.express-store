#!/usr/bin/env node
/** Validate docs/openapi.js against the official OpenAPI 3 schema. */
const SwaggerParser = require("@apidevtools/swagger-parser");
const spec = require("../docs/openapi");

SwaggerParser.validate(JSON.parse(JSON.stringify(spec)))
  .then((api) => {
    const paths = Object.keys(api.paths).length;
    const operations = Object.values(api.paths).reduce(
      (count, item) =>
        count +
        ["get", "post", "put", "patch", "delete", "head", "options"].filter((m) => item[m]).length,
      0
    );
    console.log(`OpenAPI ${api.openapi} is valid: ${paths} paths, ${operations} operations`);
  })
  .catch((error) => {
    console.error(`OpenAPI document is invalid:\n${error.message}`);
    process.exit(1);
  });
