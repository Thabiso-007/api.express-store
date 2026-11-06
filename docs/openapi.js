/**
 * OpenAPI 3.0 description of the whole API.
 *
 * This is a plain JS object (no YAML parser / build step needed). It is served
 * as JSON at /api/docs.json and rendered by Swagger UI at /api/docs.
 */
const config = require("../config/env");
const pkg = require("../package.json");

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const responseRef = (name) => ({ $ref: `#/components/responses/${name}` });
const arrayOf = (name) => ({ type: "array", items: ref(name) });

const jsonBody = (schema, example) => ({
  required: true,
  content: { "application/json": { schema, ...(example ? { example } : {}) } },
});

const jsonResponse = (description, schema, extra = {}) => ({
  description,
  content: { "application/json": { schema } },
  ...extra,
});

const ERRORS = {
  400: responseRef("BadRequest"),
  401: responseRef("Unauthorized"),
  403: responseRef("Forbidden"),
  404: responseRef("NotFound"),
  409: responseRef("Conflict"),
  413: responseRef("PayloadTooLarge"),
  500: responseRef("ServerError"),
  502: responseRef("BadGateway"),
  503: responseRef("ServiceUnavailable"),
};
const errs = (...codes) =>
  Object.fromEntries(codes.map((code) => [String(code), ERRORS[code]]));

const bearer = [{ bearerAuth: [] }];
const adminSecurity = [{ bearerAuth: [] }]; // admin flag is enforced by role
const publicSecurity = [];

const ok = (description, schema) => ({ 200: jsonResponse(description, schema) });
const created = (description, schema) => ({ 201: jsonResponse(description, schema) });

const idParam = (name = "id", description = "MongoDB ObjectId (24 hex characters)") => ({
  name,
  in: "path",
  required: true,
  description,
  schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
  example: "6507f1c2a1b2c3d4e5f607182",
});

/** Generate the standard create/read/update/delete docs for lookup collections. */
const lookupPaths = ({
  base,
  tag,
  name,
  createPath = "/create",
  createAtBase = false,
  allAlias = true,
  readAuth = false,
  extra = {},
}) => {
  const listOperation = {
    tags: [tag],
    summary: `List all ${name.toLowerCase()}s`,
    operationId: `list${name.replace(/\s/g, "")}`,
    security: readAuth ? adminSecurity : publicSecurity,
    responses: {
      ...ok(`Array of ${name.toLowerCase()}s`, arrayOf("Lookup")),
      ...errs(500),
    },
  };
  const singleOperation = {
    tags: [tag],
    summary: `Get a ${name.toLowerCase()} by id`,
    operationId: `get${name.replace(/\s/g, "")}`,
    security: readAuth ? adminSecurity : publicSecurity,
    parameters: [idParam()],
    responses: {
      ...ok(name, ref("Lookup")),
      ...errs(400, ...(readAuth ? [401, 403] : []), 404),
    },
  };
  const createOperation = {
    tags: [tag],
    summary: `Create a ${name.toLowerCase()}`,
    operationId: `create${name.replace(/\s/g, "")}`,
    security: adminSecurity,
    requestBody: jsonBody(ref("LookupInput"), { title: "Shoes" }),
    responses: { ...created(`${name} created`, ref("Lookup")), ...errs(400, 401, 403, 409) },
  };
  const updateOperation = {
    tags: [tag],
    summary: `Update a ${name.toLowerCase()}`,
    operationId: `update${name.replace(/\s/g, "")}`,
    security: adminSecurity,
    parameters: [idParam()],
    requestBody: jsonBody(ref("LookupInput")),
    responses: { ...ok(`${name} updated`, ref("Lookup")), ...errs(400, 401, 403, 404, 409) },
  };
  const deleteOperation = {
    tags: [tag],
    summary: `Delete a ${name.toLowerCase()}`,
    operationId: `delete${name.replace(/\s/g, "")}`,
    security: adminSecurity,
    parameters: [idParam()],
    responses: { ...ok(`${name} deleted`, ref("Lookup")), ...errs(400, 401, 403, 404) },
  };

  const paths = {
    [base]: {
      ...(createAtBase ? { post: createOperation } : {}),
      get: listOperation,
    },
    [`${base}${createPath}`]: createAtBase ? undefined : { post: createOperation },
    ...(allAlias ? { [`${base}/all`]: { get: { ...listOperation, operationId: `${listOperation.operationId}Alias` } } } : {}),
    [`${base}/{id}`]: {
      get: singleOperation,
      put: updateOperation,
      delete: deleteOperation,
    },
    ...extra,
  };
  if (createAtBase) delete paths[`${base}${createPath}`];
  return paths;
};

const servers = [{ url: "/", description: "This server (relative URL)" }];
if (config.api_base_url && config.api_base_url !== "/") {
  servers.push({ url: config.api_base_url, description: "Configured public API URL" });
}

const spec = {
  openapi: "3.0.3",
  info: {
    title: "api.express-store",
    version: pkg.version,
    description: `
REST API for an e-commerce store (users, products, blogs, carts, orders, coupons, uploads and PayPal payments).

### Authentication
1. Register or log in to receive a short-lived **access token** and an \`httpOnly\` **refresh cookie**.
2. Send \`Authorization: Bearer <access token>\` on protected routes (click **Authorize** and paste the token).
3. \`GET /api/user/refresh\` exchanges the refresh cookie for a new access token; \`GET /api/user/logout\` clears it.
4. Routes marked **Admin** additionally require \`role: "admin"\`.

### Health
- \`GET /api/health/live\` — liveness, always 200 while the process is up.
- \`GET /api/health/ready\` — readiness, 200 only when MongoDB is reachable, otherwise **503**.
- \`/status\` — a human-friendly, auto-refreshing status page.

### Errors
All errors share \`{ "message": "..." }\` (plus optional \`details\` and, outside production, \`stack\`).
`.trim(),
    license: { name: "ISC" },
    contact: { name: "Thabiso Hlatshwayo", url: "https://github.com/Thabiso-007/api.express-store" },
  },
  servers,
  tags: [
    { name: "System", description: "Service info, health checks and documentation" },
    { name: "Auth", description: "Registration, login, refresh, logout and password reset" },
    { name: "Users", description: "User profiles and admin user management" },
    { name: "Products", description: "Product catalogue, filtering, wishlist and ratings" },
    { name: "Cart & Orders", description: "Cart, coupons and orders" },
    { name: "Blogs", description: "Blog posts and reactions" },
    { name: "Blog Categories", description: "Blog category lookups" },
    { name: "Categories", description: "Product category lookups" },
    { name: "Brands", description: "Brand lookups" },
    { name: "Colors", description: "Color lookups" },
    { name: "Coupons", description: "Discount coupons (admin)" },
    { name: "Enquiries", description: "Contact enquiries" },
    { name: "Uploads", description: "Cloudinary image uploads" },
    { name: "Payments", description: "PayPal Orders v2" },
  ],
  paths: {
    // ------------------------------------------------------------- System --
    "/": {
      get: {
        tags: ["System"],
        summary: "Service information and documentation links",
        operationId: "getRoot",
        security: publicSecurity,
        responses: { ...ok("Service is running", ref("ApiInfo")) },
      },
    },
    "/status": {
      get: {
        tags: ["System"],
        summary: "Human-readable status page (auto-refreshing HTML)",
        operationId: "getStatusPage",
        security: publicSecurity,
        responses: {
          200: { description: "HTML status page", content: { "text/html": { schema: { type: "string" } } } },
        },
      },
    },
    "/api/docs": {
      get: {
        tags: ["System"],
        summary: "Interactive Swagger UI (redirects to /api/docs/)",
        operationId: "getSwaggerUi",
        security: publicSecurity,
        responses: {
          200: { description: "Swagger UI HTML", content: { "text/html": { schema: { type: "string" } } } },
          301: { description: "Redirect to the trailing-slash URL", headers: { Location: { schema: { type: "string" }, description: "/api/docs/" } } },
        },
      },
    },
    "/api/docs.json": {
      get: {
        tags: ["System"],
        summary: "This OpenAPI document as JSON",
        operationId: "getOpenApiSpec",
        security: publicSecurity,
        responses: {
          200: { description: "OpenAPI 3 document", content: { "application/json": { schema: { type: "object" } } } },
        },
      },
    },
    "/api/health": {
      get: {
        tags: ["System"],
        summary: "Combined health (always 200 while the process is alive)",
        description:
          "Reports process status plus the current MongoDB connection state. Use `/api/health/ready` when a monitor must fail on database outages.",
        operationId: "getHealth",
        security: publicSecurity,
        responses: { ...ok("Process is alive", ref("Health")) },
      },
    },
    "/api/health/live": {
      get: {
        tags: ["System"],
        summary: "Liveness probe",
        description: "Returns 200 whenever the Node process can serve requests. Ideal for uptime monitors.",
        operationId: "getLiveness",
        security: publicSecurity,
        responses: { ...ok("Alive", ref("Health")) },
      },
    },
    "/api/health/ready": {
      get: {
        tags: ["System"],
        summary: "Readiness probe",
        description: "Returns **200** when MongoDB is connected (and answers a ping), **503** otherwise.",
        operationId: "getReadiness",
        security: publicSecurity,
        responses: {
          ...ok("Ready to serve traffic", ref("Readiness")),
          503: jsonResponse("Not ready — database unavailable", ref("Readiness")),
        },
      },
    },

    // --------------------------------------------------------------- Auth --
    "/api/user/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        description: "Only profile fields are accepted; `role`, `isBlocked` and similar fields are ignored.",
        operationId: "register",
        security: publicSecurity,
        requestBody: jsonBody(ref("RegisterInput"), {
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
          mobile: "0821234567",
          password: "secret123",
        }),
        responses: { ...created("User created (credentials stripped)", ref("User")), ...errs(400, 409) },
      },
    },
    "/api/user/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in",
        description: "Returns an access token and sets the `refreshToken` httpOnly cookie.",
        operationId: "login",
        security: publicSecurity,
        requestBody: jsonBody(ref("LoginInput"), { email: "ada@example.com", password: "secret123" }),
        responses: {
          ...ok("Signed in", ref("AuthResponse")),
          ...errs(400, 401, 403),
        },
      },
    },
    "/api/user/admin-login": {
      post: {
        tags: ["Auth"],
        summary: "Log in as an administrator",
        operationId: "adminLogin",
        security: publicSecurity,
        requestBody: jsonBody(ref("LoginInput")),
        responses: { ...ok("Signed in", ref("AuthResponse")), ...errs(400, 401, 403) },
      },
    },
    "/api/user/forgot-password-token": {
      post: {
        tags: ["Auth"],
        summary: "Send a password-reset link by e-mail",
        description: "The token is **never** returned in the response; it is e-mailed using `APP_URL`.",
        operationId: "forgotPassword",
        security: publicSecurity,
        requestBody: jsonBody(ref("EmailInput"), { email: "ada@example.com" }),
        responses: { ...ok("Generic success message (no account enumeration)", ref("Message")), ...errs(400, 502, 503) },
      },
    },
    "/api/user/reset-password/{token}": {
      put: {
        tags: ["Auth"],
        summary: "Reset a password with the token from the e-mail",
        operationId: "resetPassword",
        security: publicSecurity,
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" }, description: "Raw reset token" }],
        requestBody: jsonBody(ref("PasswordInput"), { password: "brand-new-password" }),
        responses: { ...ok("Password reset", ref("Message")), ...errs(400) },
      },
    },
    "/api/user/refresh": {
      get: {
        tags: ["Auth"],
        summary: "Issue a new access token from the refresh cookie",
        operationId: "refreshToken",
        security: [{ refreshCookie: [] }],
        responses: { ...ok("New access token", ref("AccessToken")), ...errs(401, 403) },
      },
    },
    "/api/user/logout": {
      get: {
        tags: ["Auth"],
        summary: "Log out and invalidate the refresh token",
        operationId: "logout",
        security: [{ refreshCookie: [] }],
        responses: { 204: { description: "Logged out (no content)" } },
      },
    },

    // -------------------------------------------------------------- Users --
    "/api/user/all": {
      get: {
        tags: ["Users"],
        summary: "List all users (admin)",
        description: "Passwords, refresh tokens and reset tokens are never serialised.",
        operationId: "getAllUsers",
        security: adminSecurity,
        responses: { ...ok("Users", arrayOf("User")), ...errs(401, 403) },
      },
    },
    "/api/user/{id}": {
      get: {
        tags: ["Users"],
        summary: "Get a user (self or admin)",
        operationId: "getUser",
        security: bearer,
        parameters: [idParam("id", "User id")],
        responses: { ...ok("User", ref("User")), ...errs(400, 401, 403, 404) },
      },
      put: {
        tags: ["Users"],
        summary: "Update a user (self or admin)",
        operationId: "updateUserById",
        security: bearer,
        parameters: [idParam("id", "User id")],
        requestBody: jsonBody(ref("UserUpdateInput")),
        responses: { ...ok("Updated user", ref("User")), ...errs(400, 401, 403, 404, 409) },
      },
      delete: {
        tags: ["Users"],
        summary: "Delete a user (self or admin)",
        operationId: "deleteUser",
        security: bearer,
        parameters: [idParam("id", "User id")],
        responses: { ...ok("Deleted user", ref("User")), ...errs(400, 401, 403, 404) },
      },
    },
    "/api/user/update-user": {
      put: {
        tags: ["Users"],
        summary: "Update your own profile",
        operationId: "updateOwnUser",
        security: bearer,
        requestBody: jsonBody(ref("UserUpdateInput"), { firstName: "Ada" }),
        responses: { ...ok("Updated user", ref("User")), ...errs(400, 401, 404, 409) },
      },
    },
    "/api/user/save-address": {
      put: {
        tags: ["Users"],
        summary: "Save your address",
        operationId: "saveAddress",
        security: bearer,
        requestBody: jsonBody(ref("AddressInput"), { address: "1 Main Street, Johannesburg" }),
        responses: { ...ok("Updated user", ref("User")), ...errs(400, 401, 404) },
      },
    },
    "/api/user/update-password": {
      put: {
        tags: ["Users"],
        summary: "Change your password",
        description: "Optionally verify `currentPassword`. Previously issued tokens are invalidated.",
        operationId: "updatePassword",
        security: bearer,
        requestBody: jsonBody(ref("PasswordChangeInput"), {
          currentPassword: "secret123",
          password: "new-secret",
        }),
        responses: { ...ok("Password updated", ref("Message")), ...errs(400, 401, 404) },
      },
    },
    "/api/user/wishlist": {
      get: {
        tags: ["Users"],
        summary: "Get your populated wishlist",
        operationId: "getWishlist",
        security: bearer,
        responses: { ...ok("User with wishlist", ref("User")), ...errs(401, 404) },
      },
    },
    "/api/user/role/{id}": {
      put: {
        tags: ["Users"],
        summary: "Set a user's role (admin)",
        operationId: "updateRole",
        security: adminSecurity,
        parameters: [idParam("id", "User id")],
        requestBody: jsonBody(ref("RoleInput"), { role: "admin" }),
        responses: { ...ok("Updated user", ref("User")), ...errs(400, 401, 403, 404) },
      },
    },
    "/api/user/blocked-user/{id}": {
      put: {
        tags: ["Users"],
        summary: "Block a user (admin)",
        operationId: "blockUser",
        security: adminSecurity,
        parameters: [idParam("id", "User id")],
        responses: { ...ok("User blocked", ref("Message")), ...errs(400, 401, 403, 404) },
      },
    },
    "/api/user/unblocked-user/{id}": {
      put: {
        tags: ["Users"],
        summary: "Unblock a user (admin)",
        operationId: "unblockUser",
        security: adminSecurity,
        parameters: [idParam("id", "User id")],
        responses: { ...ok("User unblocked", ref("Message")), ...errs(400, 401, 403, 404) },
      },
    },

    // ------------------------------------------------------- Cart & orders --
    "/api/user/cart": {
      post: {
        tags: ["Cart & Orders"],
        summary: "Add or update a cart line",
        description: "The price is read from the product in the database, never from the request. Existing lines are merged.",
        operationId: "addToCart",
        security: bearer,
        requestBody: jsonBody(ref("CartInput"), {
          productId: "6507f1c2a1b2c3d4e5f607182",
          quantity: 2,
          color: "6507f1c2a1b2c3d4e5f607183",
        }),
        responses: { ...created("Cart line", ref("CartItem")), ...errs(400, 401, 404) },
      },
      get: {
        tags: ["Cart & Orders"],
        summary: "List all cart lines",
        operationId: "getCart",
        security: bearer,
        responses: { ...ok("Cart lines", arrayOf("CartItem")), ...errs(401) },
      },
    },
    "/api/user/cart/{cartItemId}/{newQuantity}": {
      put: {
        tags: ["Cart & Orders"],
        summary: "Change a cart line's quantity",
        operationId: "updateCartQuantity",
        security: bearer,
        parameters: [
          idParam("cartItemId", "Cart line id"),
          { name: "newQuantity", in: "path", required: true, schema: { type: "integer", minimum: 1, maximum: 999 }, example: 3 },
        ],
        responses: { ...ok("Updated cart line", ref("CartItem")), ...errs(400, 401, 404) },
      },
    },
    "/api/user/delete-product-cart/{cartItemId}": {
      delete: {
        tags: ["Cart & Orders"],
        summary: "Remove one cart line",
        operationId: "deleteCartLine",
        security: bearer,
        parameters: [idParam("cartItemId", "Cart line id")],
        responses: { ...ok("Removed cart line", ref("CartItem")), ...errs(400, 401, 404) },
      },
    },
    "/api/user/empty-cart": {
      delete: {
        tags: ["Cart & Orders"],
        summary: "Empty the cart",
        operationId: "emptyCart",
        security: bearer,
        responses: { ...ok("Cart emptied", ref("DeletedCount")), ...errs(401) },
      },
    },
    "/api/user/update-product-cart/{cartItemId}/{newQuantity}": {
      delete: {
        tags: ["Cart & Orders"],
        summary: "Legacy alias for changing quantity",
        deprecated: true,
        operationId: "updateCartQuantityLegacy",
        security: bearer,
        parameters: [
          idParam("cartItemId", "Cart line id"),
          { name: "newQuantity", in: "path", required: true, schema: { type: "integer", minimum: 1 }, example: 3 },
        ],
        responses: { ...ok("Updated cart line", ref("CartItem")), ...errs(400, 401, 404) },
      },
    },
    "/api/user/cart/apply-coupon": {
      post: {
        tags: ["Cart & Orders"],
        summary: "Apply a coupon to the cart",
        operationId: "applyCoupon",
        security: bearer,
        requestBody: jsonBody(ref("CouponCodeInput"), { coupon: "SAVE10" }),
        responses: { ...ok("Calculated totals", ref("CouponResult")), ...errs(400, 401, 404) },
      },
    },
    "/api/user/cart/create-order": {
      post: {
        tags: ["Cart & Orders"],
        summary: "Create an order",
        description:
          "Totals are recomputed server-side, stock is checked and decremented, `sold` is incremented and the cart is cleared. An optional `coupon` code applies a discount.",
        operationId: "createOrder",
        security: bearer,
        requestBody: jsonBody(ref("OrderInput"), {
          shippingInfo: {
            firstName: "Ada", lastName: "Lovelace", address: "1 Main Street",
            city: "Johannesburg", state: "Gauteng", pincode: "2000",
          },
          orderItems: [{ product: "6507f1c2a1b2c3d4e5f607182", quantity: 2 }],
          coupon: "SAVE10",
        }),
        responses: { ...created("Order created", ref("OrderResponse")), ...errs(400, 401, 404) },
      },
    },
    "/api/user/get-orders": {
      get: {
        tags: ["Cart & Orders"],
        summary: "List your orders",
        operationId: "getMyOrders",
        security: bearer,
        responses: { ...ok("Orders", arrayOf("Order")), ...errs(401) },
      },
    },
    "/api/user/all-orders": {
      get: {
        tags: ["Cart & Orders"],
        summary: "List all orders (admin)",
        operationId: "getAllOrders",
        security: adminSecurity,
        responses: { ...ok("Orders", arrayOf("Order")), ...errs(401, 403) },
      },
    },
    "/api/user/order/update-order/{id}": {
      put: {
        tags: ["Cart & Orders"],
        summary: "Update an order's status (admin)",
        operationId: "updateOrderStatus",
        security: adminSecurity,
        parameters: [idParam("id", "Order id")],
        requestBody: jsonBody(ref("OrderStatusInput"), { orderStatus: "Shipped" }),
        responses: { ...ok("Updated order", ref("Order")), ...errs(400, 401, 403, 404) },
      },
    },

    // ------------------------------------------------------------ Products --
    "/api/product": {
      get: {
        tags: ["Products"],
        summary: "List products (filter, sort, project, paginate)",
        description:
          "Only known fields may be filtered. Operators (`gte`, `gt`, `lte`, `lt`, `eq`, `ne`, `in`, `nin`) are passed as nested query keys, e.g. `price[gte]=100`. `X-Total-Count` and `X-Total-Pages` headers carry the totals.",
        operationId: "listProducts",
        security: publicSecurity,
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 12 } },
          { name: "sort", in: "query", description: "Comma-separated fields; prefix with - for descending", schema: { type: "string" }, example: "-price,title" },
          { name: "fields", in: "query", description: "Comma-separated projection", schema: { type: "string" }, example: "title,price" },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "brand", in: "query", schema: { type: "string" } },
          { name: "price[gte]", in: "query", schema: { type: "number" }, example: 100 },
          { name: "price[lte]", in: "query", schema: { type: "number" }, example: 500 },
        ],
        responses: {
          200: jsonResponse("Products", arrayOf("Product"), {
            headers: {
              "X-Total-Count": { description: "Total matching documents", schema: { type: "integer" } },
              "X-Total-Pages": { description: "Total pages", schema: { type: "integer" } },
            },
          }),
          ...errs(400, 404),
        },
      },
    },
    "/api/product/create": {
      post: {
        tags: ["Products"],
        summary: "Create a product (admin)",
        description: "A unique slug is generated from the title.",
        operationId: "createProduct",
        security: adminSecurity,
        requestBody: jsonBody(ref("ProductInput"), {
          title: "Running Shoe",
          description: "Lightweight trainer",
          price: 999.99,
          category: "Shoes",
          brand: "Acme",
          quantity: 25,
        }),
        responses: { ...created("Product created", ref("Product")), ...errs(400, 401, 403, 409) },
      },
    },
    "/api/product/{id}": {
      get: {
        tags: ["Products"],
        summary: "Get a product",
        operationId: "getProduct",
        security: publicSecurity,
        parameters: [idParam("id", "Product id")],
        responses: { ...ok("Product", ref("Product")), ...errs(400, 404) },
      },
      put: {
        tags: ["Products"],
        summary: "Update a product (admin)",
        operationId: "updateProduct",
        security: adminSecurity,
        parameters: [idParam("id", "Product id")],
        requestBody: jsonBody(ref("ProductUpdateInput"), { price: 899.99 }),
        responses: { ...ok("Updated product", ref("Product")), ...errs(400, 401, 403, 404, 409) },
      },
      delete: {
        tags: ["Products"],
        summary: "Delete a product (admin)",
        operationId: "deleteProduct",
        security: adminSecurity,
        parameters: [idParam("id", "Product id")],
        responses: { ...ok("Deleted product", ref("Product")), ...errs(400, 401, 403, 404) },
      },
    },
    "/api/product/wishlist": {
      put: {
        tags: ["Products"],
        summary: "Toggle a product in your wishlist",
        operationId: "toggleWishlist",
        security: bearer,
        requestBody: jsonBody(ref("ProductIdInput"), { prodId: "6507f1c2a1b2c3d4e5f607182" }),
        responses: { ...ok("Updated user", ref("User")), ...errs(400, 401, 404) },
      },
    },
    "/api/product/rating": {
      put: {
        tags: ["Products"],
        summary: "Rate a product (1–5, one rating per user)",
        operationId: "rateProduct",
        security: bearer,
        requestBody: jsonBody(ref("RatingInput"), {
          star: 5, prodId: "6507f1c2a1b2c3d4e5f607182", comment: "Excellent",
        }),
        responses: { ...ok("Updated product with new average", ref("Product")), ...errs(400, 401, 404) },
      },
    },
    "/api/product/uploads/{id}": {
      put: {
        tags: ["Products"],
        summary: "Upload product images (admin)",
        operationId: "uploadProductImages",
        security: adminSecurity,
        parameters: [idParam("id", "Product id")],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: { type: "object", properties: { images: { type: "array", items: { type: "string", format: "binary" } } }, required: ["images"] },
            },
          },
        },
        responses: { ...ok("Updated product", ref("Product")), ...errs(400, 401, 403, 404, 413, 502, 503) },
      },
    },

    // --------------------------------------------------------------- Blogs --
    "/api/blog": {
      get: {
        tags: ["Blogs"],
        summary: "List blogs",
        operationId: "listBlogs",
        security: publicSecurity,
        responses: { ...ok("Blogs", arrayOf("Blog")), ...errs(500) },
      },
    },
    "/api/blog/create": {
      post: {
        tags: ["Blogs"],
        summary: "Create a blog (admin)",
        operationId: "createBlog",
        security: adminSecurity,
        requestBody: jsonBody(ref("BlogInput"), {
          title: "New season", description: "What's new in store", category: "News",
        }),
        responses: { ...created("Blog created", ref("BlogCreated")), ...errs(400, 401, 403) },
      },
    },
    "/api/blog/likes": {
      put: {
        tags: ["Blogs"],
        summary: "Toggle your like on a blog",
        operationId: "likeBlog",
        security: bearer,
        requestBody: jsonBody(ref("ReactionInput"), { blogId: "6507f1c2a1b2c3d4e5f607182" }),
        responses: { ...ok("Updated blog", ref("Blog")), ...errs(400, 401, 404) },
      },
    },
    "/api/blog/dislikes": {
      put: {
        tags: ["Blogs"],
        summary: "Toggle your dislike on a blog",
        operationId: "dislikeBlog",
        security: bearer,
        requestBody: jsonBody(ref("ReactionInput")),
        responses: { ...ok("Updated blog", ref("Blog")), ...errs(400, 401, 404) },
      },
    },
    "/api/blog/uploads/{id}": {
      put: {
        tags: ["Blogs"],
        summary: "Upload blog images (admin)",
        operationId: "uploadBlogImages",
        security: adminSecurity,
        parameters: [idParam("id", "Blog id")],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: { type: "object", properties: { images: { type: "array", items: { type: "string", format: "binary" } } }, required: ["images"] },
            },
          },
        },
        responses: { ...ok("Updated blog", ref("Blog")), ...errs(400, 401, 403, 404, 413, 502, 503) },
      },
    },
    "/api/blog/{id}": {
      get: {
        tags: ["Blogs"],
        summary: "Get a blog (increments numViews)",
        operationId: "getBlog",
        security: publicSecurity,
        parameters: [idParam("id", "Blog id")],
        responses: { ...ok("Blog", ref("Blog")), ...errs(400, 404) },
      },
      put: {
        tags: ["Blogs"],
        summary: "Update a blog (admin)",
        operationId: "updateBlog",
        security: adminSecurity,
        parameters: [idParam("id", "Blog id")],
        requestBody: jsonBody(ref("BlogUpdateInput"), { title: "Updated title" }),
        responses: { ...ok("Updated blog", ref("Blog")), ...errs(400, 401, 403, 404) },
      },
      delete: {
        tags: ["Blogs"],
        summary: "Delete a blog (admin)",
        operationId: "deleteBlog",
        security: adminSecurity,
        parameters: [idParam("id", "Blog id")],
        responses: { ...ok("Deleted blog", ref("Blog")), ...errs(400, 401, 403, 404) },
      },
    },

    // ------------------------------------------------- Lookup collections --
    ...lookupPaths({ base: "/api/blog/category", tag: "Blog Categories", name: "Blog Category" }),
    ...lookupPaths({ base: "/api/category", tag: "Categories", name: "Category" }),
    ...lookupPaths({ base: "/api/brand", tag: "Brands", name: "Brand" }),
    ...lookupPaths({
      base: "/api/color",
      tag: "Colors",
      name: "Color",
      createAtBase: true,
      allAlias: false,
    }),

    // ------------------------------------------------------------- Coupons --
    "/api/coupon/create": {
      post: {
        tags: ["Coupons"],
        summary: "Create a coupon (admin)",
        operationId: "createCoupon",
        security: adminSecurity,
        requestBody: jsonBody(ref("CouponInput"), { name: "SAVE10", expiry: "2027-01-01", discount: 10 }),
        responses: { ...created("Coupon created", ref("Coupon")), ...errs(400, 401, 403, 409) },
      },
    },
    "/api/coupon": {
      get: {
        tags: ["Coupons"],
        summary: "List all coupons (admin)",
        operationId: "listCoupons",
        security: adminSecurity,
        responses: { ...ok("Coupons", arrayOf("Coupon")), ...errs(401, 403) },
      },
    },
    "/api/coupon/name/{name}": {
      get: {
        tags: ["Coupons"],
        summary: "Get a coupon by name (admin)",
        operationId: "getCouponByName",
        security: adminSecurity,
        parameters: [{ name: "name", in: "path", required: true, schema: { type: "string" }, example: "SAVE10" }],
        responses: { ...ok("Coupon", ref("Coupon")), ...errs(400, 401, 403, 404) },
      },
    },
    "/api/coupon/{id}": {
      get: {
        tags: ["Coupons"],
        summary: "Get a coupon by id (admin)",
        operationId: "getCoupon",
        security: adminSecurity,
        parameters: [idParam()],
        responses: { ...ok("Coupon", ref("Coupon")), ...errs(400, 401, 403, 404) },
      },
      put: {
        tags: ["Coupons"],
        summary: "Update a coupon (admin)",
        operationId: "updateCoupon",
        security: adminSecurity,
        parameters: [idParam()],
        requestBody: jsonBody(ref("CouponInput")),
        responses: { ...ok("Updated coupon", ref("Coupon")), ...errs(400, 401, 403, 404, 409) },
      },
      delete: {
        tags: ["Coupons"],
        summary: "Delete a coupon (admin)",
        operationId: "deleteCoupon",
        security: adminSecurity,
        parameters: [idParam()],
        responses: { ...ok("Deleted coupon", ref("Coupon")), ...errs(400, 401, 403, 404) },
      },
    },

    // ----------------------------------------------------------- Enquiries --
    "/api/enquiry": {
      post: {
        tags: ["Enquiries"],
        summary: "Submit a contact enquiry (public)",
        operationId: "createEnquiry",
        security: publicSecurity,
        requestBody: jsonBody(ref("EnquiryInput"), {
          name: "Ada", email: "ada@example.com", mobile: "0821234567", comment: "Do you ship internationally?",
        }),
        responses: { ...created("Enquiry created", ref("Enquiry")), ...errs(400) },
      },
      get: {
        tags: ["Enquiries"],
        summary: "List enquiries (admin)",
        description: "Admin-only because enquiries contain personal data.",
        operationId: "listEnquiries",
        security: adminSecurity,
        responses: { ...ok("Enquiries", arrayOf("Enquiry")), ...errs(401, 403) },
      },
    },
    "/api/enquiry/{id}": {
      get: {
        tags: ["Enquiries"],
        summary: "Get an enquiry (admin)",
        operationId: "getEnquiry",
        security: adminSecurity,
        parameters: [idParam()],
        responses: { ...ok("Enquiry", ref("Enquiry")), ...errs(400, 401, 403, 404) },
      },
      put: {
        tags: ["Enquiries"],
        summary: "Update an enquiry status (admin)",
        operationId: "updateEnquiry",
        security: adminSecurity,
        parameters: [idParam()],
        requestBody: jsonBody(ref("EnquiryUpdateInput"), { status: "Contacted" }),
        responses: { ...ok("Updated enquiry", ref("Enquiry")), ...errs(400, 401, 403, 404) },
      },
      delete: {
        tags: ["Enquiries"],
        summary: "Delete an enquiry (admin)",
        operationId: "deleteEnquiry",
        security: adminSecurity,
        parameters: [idParam()],
        responses: { ...ok("Deleted enquiry", ref("Enquiry")), ...errs(400, 401, 403, 404) },
      },
    },

    // ------------------------------------------------------------ Uploads --
    "/api/uploads": {
      post: {
        tags: ["Uploads"],
        summary: "Upload images (admin)",
        description: "Files are kept in memory, resized by Cloudinary, and returned as URL/public_id pairs.",
        operationId: "uploadImages",
        security: adminSecurity,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: { type: "object", properties: { images: { type: "array", items: { type: "string", format: "binary" } } }, required: ["images"] },
            },
          },
        },
        responses: { ...ok("Uploaded images", arrayOf("Image")), ...errs(400, 401, 403, 413, 502, 503) },
      },
    },
    "/api/uploads/delete-img/{publicId}": {
      delete: {
        tags: ["Uploads"],
        summary: "Delete a Cloudinary image (admin)",
        description: "A wildcard route (`/api/uploads/delete-img/*`) also accepts public ids containing slashes.",
        operationId: "deleteImage",
        security: adminSecurity,
        parameters: [{
          name: "publicId", in: "path", required: true,
          schema: { type: "string" }, example: "express-store/products/image",
        }],
        responses: { ...ok("Deleted", ref("Message")), ...errs(400, 401, 403, 404, 502, 503) },
      },
    },

    // ----------------------------------------------------------- Payments --
    "/api/orders": {
      post: {
        tags: ["Payments"],
        summary: "Create a PayPal order",
        operationId: "createPayPalOrder",
        security: bearer,
        requestBody: jsonBody(ref("PayPalOrderInput"), { product: { cost: "25.00" } }),
        responses: { 201: jsonResponse("PayPal order created", { type: "object", additionalProperties: true }), ...errs(400, 401, 502, 503) },
      },
    },
    "/api/orders/{orderID}/capture": {
      post: {
        tags: ["Payments"],
        summary: "Capture a PayPal order",
        operationId: "capturePayPalOrder",
        security: bearer,
        parameters: [{ name: "orderID", in: "path", required: true, schema: { type: "string" }, example: "5O190127TN364715T" }],
        responses: { 200: jsonResponse("Capture result", { type: "object", additionalProperties: true }), ...errs(400, 401, 502, 503) },
      },
    },
  },

  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Paste the access token returned by /api/user/login (without the 'Bearer' prefix).",
      },
      refreshCookie: {
        type: "apiKey",
        in: "cookie",
        name: "refreshToken",
        description: "httpOnly cookie set at login; used by /refresh and /logout.",
      },
    },
    parameters: {
      Id: idParam(),
    },
    responses: {
      BadRequest: { description: "Validation error (malformed id, missing field, bad filter, expired token)", content: { "application/json": { schema: ref("Error") } } },
      Unauthorized: { description: "Missing, invalid or expired token / invalid credentials", content: { "application/json": { schema: ref("Error") } } },
      Forbidden: { description: "Blocked account or insufficient permissions", content: { "application/json": { schema: ref("Error") } } },
      NotFound: { description: "Resource or route not found", content: { "application/json": { schema: ref("Error") } } },
      Conflict: { description: "Duplicate unique field", content: { "application/json": { schema: ref("Error") } } },
      PayloadTooLarge: { description: "Uploaded file exceeds 5 MB", content: { "application/json": { schema: ref("Error") } } },
      ServerError: { description: "Unexpected server error", content: { "application/json": { schema: ref("Error") } } },
      BadGateway: { description: "PayPal, SMTP or Cloudinary failed", content: { "application/json": { schema: ref("Error") } } },
      ServiceUnavailable: { description: "Integration not configured or database not ready", content: { "application/json": { schema: ref("Error") } } },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          message: { type: "string", example: "Product not found" },
          details: { type: "array", items: { type: "string" } },
          stack: { type: "string", description: "Only included outside production" },
        },
        required: ["message"],
      },
      Message: { type: "object", properties: { message: { type: "string" }, user: ref("User") }, required: ["message"] },
      ApiInfo: {
        type: "object",
        properties: {
          name: { type: "string" },
          status: { type: "string", example: "running" },
          version: { type: "string" },
          docs: { type: "string", format: "uri", example: "/api/docs" },
          health: { type: "string", example: "/api/health" },
          statusPage: { type: "string", example: "/status" },
          openapi: { type: "string", example: "/api/docs.json" },
          repository: { type: "string", format: "uri" },
        },
      },
      Health: {
        type: "object",
        properties: {
          status: { type: "string", example: "ok" },
          name: { type: "string" },
          version: { type: "string" },
          environment: { type: "string", example: "production" },
          uptime: { type: "number", description: "Seconds since process start" },
          timestamp: { type: "string", format: "date-time" },
          database: { type: "string", enum: ["disconnected", "connected", "connecting", "disconnecting", "unknown"] },
          checks: {
            type: "object",
            properties: { process: { type: "string", example: "ok" }, database: ref("DatabaseStatus") },
          },
        },
        required: ["status"],
      },
      Readiness: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["ready", "unavailable"] },
          checks: { type: "object", properties: { process: { type: "string" }, database: ref("DatabaseStatus") } },
          error: { type: "string", description: "Present when a database ping fails" },
        },
        required: ["status"],
      },
      DatabaseStatus: {
        type: "object",
        properties: {
          state: { type: "string", enum: ["disconnected", "connected", "connecting", "disconnecting", "unknown"] },
          readyState: { type: "integer", enum: [0, 1, 2, 3] },
          connected: { type: "boolean" },
          host: { type: "string", nullable: true },
          name: { type: "string", nullable: true },
          ping: { type: "string", enum: ["ok", "failed"] },
        },
      },
      User: {
        type: "object",
        properties: {
          _id: { type: "string" }, id: { type: "string" },
          firstName: { type: "string" }, lastName: { type: "string" },
          email: { type: "string", format: "email" }, mobile: { type: "string" },
          role: { type: "string", enum: ["user", "admin"] },
          isBlocked: { type: "boolean" }, address: { type: "string" },
          wishlist: { type: "array", items: { type: "string" } },
          createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          _id: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" },
          email: { type: "string" }, mobile: { type: "string" }, role: { type: "string" },
          isBlocked: { type: "boolean" }, token: { type: "string", description: "JWT access token" },
        },
        required: ["token"],
      },
      AccessToken: { type: "object", properties: { accessToken: { type: "string" }, token: { type: "string" } } },
      RegisterInput: {
        type: "object",
        properties: {
          firstName: { type: "string" }, lastName: { type: "string" },
          email: { type: "string", format: "email" }, mobile: { type: "string" },
          password: { type: "string", minLength: 6, format: "password" },
        },
        required: ["firstName", "lastName", "email", "mobile", "password"],
      },
      LoginInput: {
        type: "object",
        properties: { email: { type: "string", format: "email" }, password: { type: "string", format: "password" } },
        required: ["email", "password"],
      },
      EmailInput: { type: "object", properties: { email: { type: "string", format: "email" } }, required: ["email"] },
      PasswordInput: { type: "object", properties: { password: { type: "string", minLength: 6, format: "password" } }, required: ["password"] },
      PasswordChangeInput: {
        type: "object",
        properties: {
          currentPassword: { type: "string", format: "password", description: "Optional; verified when supplied" },
          password: { type: "string", minLength: 6, format: "password" },
        },
        required: ["password"],
      },
      UserUpdateInput: {
        type: "object",
        properties: {
          firstName: { type: "string" }, lastName: { type: "string" },
          email: { type: "string", format: "email" }, mobile: { type: "string" },
        },
        minProperties: 1,
      },
      AddressInput: { type: "object", properties: { address: { type: "string" } }, required: ["address"] },
      RoleInput: { type: "object", properties: { role: { type: "string", enum: ["user", "admin"] } }, required: ["role"] },
      Image: {
        type: "object",
        properties: { url: { type: "string", format: "uri" }, asset_id: { type: "string" }, public_id: { type: "string" } },
      },
      Lookup: {
        type: "object",
        properties: {
          _id: { type: "string" }, title: { type: "string" },
          createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
        },
      },
      LookupInput: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
      Product: {
        type: "object",
        properties: {
          _id: { type: "string" }, title: { type: "string" }, slug: { type: "string" },
          description: { type: "string" }, price: { type: "number" }, category: { type: "string" },
          brand: { type: "string" }, quantity: { type: "integer" }, sold: { type: "integer" },
          images: { type: "array", items: ref("Image") },
          color: { type: "array", items: { type: "string" } },
          tags: { type: "string" }, totalrating: { type: "number", minimum: 0, maximum: 5 },
          ratings: {
            type: "array",
            items: {
              type: "object",
              properties: { star: { type: "integer", minimum: 1, maximum: 5 }, comment: { type: "string" }, postedby: { type: "string" } },
            },
          },
          createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
        },
      },
      ProductInput: {
        type: "object",
        properties: {
          title: { type: "string" }, description: { type: "string" }, price: { type: "number", minimum: 0 },
          category: { type: "string" }, brand: { type: "string" }, quantity: { type: "integer", minimum: 0 },
          tags: { type: "string" }, color: { type: "array", items: { type: "string" } },
        },
        required: ["title", "description", "price", "category", "brand", "quantity"],
      },
      ProductUpdateInput: {
        type: "object",
        minProperties: 1,
        description: "Any subset of product fields.",
        properties: {
          title: { type: "string" }, description: { type: "string" },
          price: { type: "number", minimum: 0 }, category: { type: "string" },
          brand: { type: "string" }, quantity: { type: "integer", minimum: 0 },
          tags: { type: "string" }, color: { type: "array", items: { type: "string" } },
        },
      },
      ProductIdInput: { type: "object", properties: { prodId: { type: "string" } }, required: ["prodId"] },
      RatingInput: {
        type: "object",
        properties: { star: { type: "integer", minimum: 1, maximum: 5 }, prodId: { type: "string" }, comment: { type: "string" } },
        required: ["star", "prodId"],
      },
      Blog: {
        type: "object",
        properties: {
          _id: { type: "string" }, title: { type: "string" }, description: { type: "string" },
          category: { type: "string" }, author: { type: "string" }, numViews: { type: "integer" },
          isLiked: { type: "boolean" }, isDisliked: { type: "boolean" },
          likes: { type: "array", items: { type: "string" } }, dislikes: { type: "array", items: { type: "string" } },
          images: { type: "array", items: ref("Image") },
          createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
        },
      },
      BlogCreated: { type: "object", properties: { status: { type: "string", example: "success" }, newBlog: ref("Blog") } },
      BlogInput: {
        type: "object",
        properties: { title: { type: "string" }, description: { type: "string" }, category: { type: "string" }, author: { type: "string" } },
        required: ["title", "description", "category"],
      },
      BlogUpdateInput: { type: "object", minProperties: 1, properties: { title: { type: "string" }, description: { type: "string" }, category: { type: "string" }, author: { type: "string" } } },
      ReactionInput: { type: "object", properties: { blogId: { type: "string" } }, required: ["blogId"] },
      Coupon: {
        type: "object",
        properties: { _id: { type: "string" }, name: { type: "string" }, expiry: { type: "string", format: "date-time" }, discount: { type: "number", minimum: 1, maximum: 100 }, createdAt: { type: "string", format: "date-time" } },
      },
      CouponInput: {
        type: "object",
        properties: { name: { type: "string" }, expiry: { type: "string", format: "date" }, discount: { type: "number", minimum: 1, maximum: 100 } },
        required: ["name", "expiry", "discount"],
      },
      CouponCodeInput: { type: "object", properties: { coupon: { type: "string" } }, required: ["coupon"] },
      CouponResult: {
        type: "object",
        properties: {
          coupon: { type: "string" }, discount: { type: "number" }, cartTotal: { type: "number" },
          discountAmount: { type: "number" }, totalAfterDiscount: { type: "number" },
        },
      },
      CartItem: {
        type: "object",
        properties: {
          _id: { type: "string" }, userId: { type: "string" }, productId: { type: "string" },
          color: { type: "string" }, quantity: { type: "integer" }, price: { type: "number" },
        },
      },
      CartInput: {
        type: "object",
        properties: { productId: { type: "string" }, quantity: { type: "integer", minimum: 1, maximum: 999 }, color: { type: "string" } },
        required: ["productId", "quantity"],
      },
      DeletedCount: { type: "object", properties: { deletedCount: { type: "integer" }, success: { type: "boolean" } } },
      ShippingInfo: {
        type: "object",
        properties: {
          firstName: { type: "string" }, lastName: { type: "string" }, address: { type: "string" },
          city: { type: "string" }, state: { type: "string" }, pincode: { type: "string" }, other: { type: "string" },
        },
        required: ["firstName", "lastName", "address", "city", "state", "pincode"],
      },
      OrderItemInput: {
        type: "object",
        properties: { product: { type: "string" }, quantity: { type: "integer", minimum: 1 }, color: { type: "string" } },
        required: ["product", "quantity"],
      },
      OrderInput: {
        type: "object",
        properties: {
          shippingInfo: ref("ShippingInfo"),
          orderItems: { type: "array", minItems: 1, items: ref("OrderItemInput") },
          coupon: { type: "string" },
          paymentInfo: { type: "object", additionalProperties: { type: "string" } },
        },
        required: ["shippingInfo", "orderItems"],
      },
      Order: {
        type: "object",
        properties: {
          _id: { type: "string" }, user: { type: "string" }, shippingInfo: ref("ShippingInfo"),
          orderItems: { type: "array", items: { type: "object", properties: { product: { type: "string" }, quantity: { type: "integer" }, price: { type: "number" }, color: { type: "string" } } } },
          totalPrice: { type: "number" }, totalPriceAfterDiscount: { type: "number" },
          orderStatus: { type: "string", enum: ["Ordered", "Processing", "Shipped", "Delivered", "Cancelled"] },
          coupon: { type: "string" }, paidAt: { type: "string", format: "date-time" },
        },
      },
      OrderResponse: { type: "object", properties: { order: ref("Order"), success: { type: "boolean" } } },
      OrderStatusInput: {
        type: "object",
        properties: { orderStatus: { type: "string", enum: ["Ordered", "Processing", "Shipped", "Delivered", "Cancelled"] } },
        required: ["orderStatus"],
      },
      Enquiry: {
        type: "object",
        properties: {
          _id: { type: "string" }, name: { type: "string" }, email: { type: "string", format: "email" },
          mobile: { type: "string" }, comment: { type: "string" },
          status: { type: "string", enum: ["Submitted", "Contacted", "In Progress", "Resolved"] },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      EnquiryInput: {
        type: "object",
        properties: { name: { type: "string" }, email: { type: "string", format: "email" }, mobile: { type: "string" }, comment: { type: "string" } },
        required: ["name", "email", "mobile", "comment"],
      },
      EnquiryUpdateInput: {
        type: "object", minProperties: 1,
        properties: { name: { type: "string" }, email: { type: "string" }, mobile: { type: "string" }, comment: { type: "string" }, status: { type: "string", enum: ["Submitted", "Contacted", "In Progress", "Resolved"] } },
      },
      PayPalOrderInput: {
        type: "object",
        properties: {
          product: { type: "object", properties: { cost: { type: "string", example: "25.00" } }, required: ["cost"] },
          amount: { type: "number", description: "Alternative to product.cost" },
          total: { type: "number", description: "Alternative to product.cost" },
        },
      },
    },
  },
  security: [],
};

module.exports = spec;
