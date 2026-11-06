const ApiError = require("./apiError");
const { parseIntInRange } = require("./helpers");

/** Only these product fields can be used as filters / sort keys / projections. */
const FILTERABLE_FIELDS = [
  "title",
  "slug",
  "description",
  "category",
  "brand",
  "price",
  "quantity",
  "sold",
  "totalrating",
  "tags",
  "color",
];
const NUMERIC_FIELDS = ["price", "quantity", "sold", "totalrating"];
const OPERATORS = ["gte", "gt", "lte", "lt", "eq", "ne", "in", "nin"];
const PAGINATION_FIELDS = ["page", "sort", "limit", "fields"];
const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype", "$where"];

const assertSafeKey = (key) => {
  if (typeof key !== "string" || key.startsWith("$") || FORBIDDEN_KEYS.includes(key)) {
    throw ApiError.badRequest("Invalid filter");
  }
};

const coerce = (field, value) => {
  if (NUMERIC_FIELDS.includes(field)) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw ApiError.badRequest(`Filter ${field} must be a number`);
    }
    return number;
  }
  if (typeof value === "object" && value !== null) {
    throw ApiError.badRequest(`Invalid value for filter ${field}`);
  }
  return value;
};

const parseCondition = (field, raw) => {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return coerce(field, raw);
  }

  const condition = {};
  for (const [operator, value] of Object.entries(raw)) {
    assertSafeKey(operator);
    if (!OPERATORS.includes(operator)) {
      throw ApiError.badRequest(`Unsupported filter operator: ${operator}`);
    }
    if (operator === "in" || operator === "nin") {
      const list = Array.isArray(value)
        ? value
        : String(value)
            .split(",")
            .map((item) => item.trim());
      condition[`$${operator}`] = list.map((item) => coerce(field, item));
    } else {
      condition[`$${operator}`] = coerce(field, value);
    }
  }
  return condition;
};

/**
 * Build a safe Mongoose query from the request query string.
 * Supports `price[gte]=100`, `category=shoes`, `sort=-price,title`,
 * `fields=title,price`, `page=2&limit=20`.
 */
const buildProductQuery = (query = {}) => {
  const filter = {};
  for (const [key, value] of Object.entries(query)) {
    if (PAGINATION_FIELDS.includes(key)) continue;
    assertSafeKey(key);
    if (!FILTERABLE_FIELDS.includes(key)) {
      throw ApiError.badRequest(`Unknown filter field: ${key}`);
    }
    // Legacy clients sometimes send a JSON encoded operator object.
    let parsed = value;
    if (typeof value === "string" && /^\{.*\}$/.test(value.trim())) {
      try {
        parsed = JSON.parse(value);
      } catch {
        throw ApiError.badRequest(`Invalid JSON in filter ${key}`);
      }
    }
    filter[key] = parseCondition(key, parsed);
  }

  let sort = "-createdAt";
  if (query.sort !== undefined) {
    const parts = String(query.sort)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    sort = parts
      .map((part) => {
        const field = part.startsWith("-") ? part.slice(1) : part;
        if (!FILTERABLE_FIELDS.includes(field) && field !== "createdAt" && field !== "updatedAt") {
          throw ApiError.badRequest(`Unknown sort field: ${field}`);
        }
        return part;
      })
      .join(" ");
  }

  let fields = "-__v";
  if (query.fields !== undefined) {
    const parts = String(query.fields)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    for (const part of parts) {
      const field = part.startsWith("-") ? part.slice(1) : part;
      if (!FILTERABLE_FIELDS.includes(field) && !["_id", "images", "ratings", "createdAt", "updatedAt"].includes(field)) {
        throw ApiError.badRequest(`Unknown projection field: ${field}`);
      }
    }
    fields = parts.join(" ");
  }

  const page = parseIntInRange(query.page, { field: "page", defaultValue: 1, min: 1 });
  const limit = parseIntInRange(query.limit, { field: "limit", defaultValue: 12, min: 1, max: 100 });
  const skip = (page - 1) * limit;

  return { filter, sort, fields, skip, limit, page };
};

module.exports = { buildProductQuery, FILTERABLE_FIELDS };
