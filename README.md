# api.express-store

A REST API for an e-commerce store: users, products, categories, brands, colors,
blogs, coupons, enquiries, carts, orders, image uploads and PayPal payments.
Built with Express, MongoDB/Mongoose and JWT authentication.

---

## Requirements

- **Node.js 20 or newer** (Node 20+ is required by `nodemailer` 10 and for the
  built-in `--watch` / `node --test` tooling)
- A MongoDB database (local or Atlas)

## Installation

```bash
git clone https://github.com/Thabiso-007/api.express-store.git
cd api.express-store
npm ci
cp .env.example .env      # then fill in your own values
npm run dev               # or: npm start
```

The server listens on `PORT` (default `5000`) and binds to `0.0.0.0`.
`GET /` returns a small status payload and `GET /api/health` reports the
database connection state.

### Scripts

| Command | Description |
| --- | --- |
| `npm start` | Run the server (`node index.js`) |
| `npm run dev` | Run with auto-reload (`node --watch index.js`) |
| `npm test` | Run the 46 regression tests (no MongoDB needed) |
| `npm run audit` | Check production dependencies for known vulnerabilities |

### Environment variables

See [`.env.example`](./.env.example) for the annotated template. `MONGO_URI`
and `JWT_SECRET` are required and the server fails fast with a readable message
if either is missing.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port (default `5000`) |
| `NODE_ENV` | `development` / `production` / `test` |
| `CLIENT_URL` | Comma-separated allowed CORS origins (empty = reflect origin) |
| `APP_URL` | Frontend base URL used to build password-reset links |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign access and refresh tokens |
| `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN` | Token lifetimes (default `1h` / `1d`) |
| `EMAIL_ADDRESS`, `EMAIL_PASSWORD`, `EMAIL_FROM` | SMTP credentials for password reset |
| `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET` | Cloudinary image uploads |
| `PAYPAL_MODE`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_CURRENCY` | PayPal Orders v2 |

Never commit `.env`; it is git-ignored.

---

## Authentication

1. `POST /api/user/register` or `POST /api/user/login` returns a short-lived
   **access token** (`token`) and sets a **refresh token** in an `httpOnly`
   cookie (24 h, `SameSite=None; Secure` in production).
2. Send the access token as `Authorization: Bearer <token>` on protected routes.
3. `GET /api/user/refresh` exchanges the refresh cookie for a new access token.
4. `GET /api/user/logout` clears both.

Middleware checks that the user still exists, is not blocked, and that the
token was issued after the last password change. `admin` routes additionally
require `role === "admin"`. Registering never accepts `role`, `isBlocked`,
`wishlist` or `refreshToken` from the request body.

### Response / error format

Success responses return JSON (mostly the created/updated document). Errors
share one shape:

```json
{ "message": "Product not found" }
```

| Status | Meaning |
| --- | --- |
| `400` | Validation error, malformed id / filter, expired reset token |
| `401` | Missing, invalid or expired token, invalid credentials |
| `403` | Blocked account or insufficient permissions |
| `404` | Unknown route or resource |
| `409` | Duplicate unique field (email, slug, coupon name, …) |
| `413` | Uploaded file too large |
| `502` / `503` | PayPal / SMTP / Cloudinary unavailable or unconfigured |

Stack traces are only included outside production.

---

## API endpoints

`🔓` public · `🔑` any authenticated user · `🛡️` admin only · `🍪` refresh cookie.

### Users, auth, cart, wishlist, orders

| Method | Endpoint | Access | Action |
| --- | --- | --- | --- |
| POST | `/api/user/register` | 🔓 | Create an account |
| POST | `/api/user/login` | 🔓 | Log in |
| POST | `/api/user/admin-login` | 🔓 | Log in as an admin |
| POST | `/api/user/forgot-password-token` | 🔓 | E-mail a reset link (never returns the token) |
| PUT | `/api/user/reset-password/:token` | 🔓 | Set a new password |
| GET | `/api/user/refresh` | 🍪 | Issue a new access token |
| GET | `/api/user/logout` | 🍪 | Invalidate the refresh token |
| GET | `/api/user/all` | 🛡️ | List users (credentials stripped) |
| GET | `/api/user/:id` | 🔑 | Get own profile (admins: any) |
| DELETE | `/api/user/:id` | 🔑 | Delete own account (admins: any) |
| PUT | `/api/user/update-user` | 🔑 | Update own profile |
| PUT | `/api/user/:id` | 🔑 | Update the targeted user (self or admin) |
| PUT | `/api/user/save-address` | 🔑 | Save the address |
| PUT | `/api/user/update-password` | 🔑 | Change password (optional `currentPassword`) |
| PUT | `/api/user/role/:id` | 🛡️ | Set `role` to `user` or `admin` |
| PUT | `/api/user/blocked-user/:id` | 🛡️ | Block a user |
| PUT | `/api/user/unblocked-user/:id` | 🛡️ | Unblock a user |
| POST | `/api/user/cart` | 🔑 | Add/update a cart line (price taken from the DB) |
| GET | `/api/user/cart` | 🔑 | List all cart lines |
| DELETE | `/api/user/empty-cart` | 🔑 | Empty the cart |
| DELETE | `/api/user/delete-product-cart/:cartItemId` | 🔑 | Remove one cart line |
| PUT | `/api/user/cart/:cartItemId/:newQuantity` | 🔑 | Change a line's quantity |
| POST | `/api/user/cart/apply-coupon` | 🔑 | Apply a coupon to the cart |
| POST | `/api/user/cart/create-order` | 🔑 | Create an order (server-side totals + stock) |
| GET | `/api/user/get-orders` | 🔑 | List own orders |
| GET | `/api/user/all-orders` | 🛡️ | List all orders |
| PUT | `/api/user/order/update-order/:id` | 🛡️ | Update order status |
| GET | `/api/user/wishlist` | 🔑 | Get the populated wishlist |

`DELETE /api/user/update-product-cart/:cartItemId/:newQuantity` is kept as a
legacy alias for changing quantity, but the `PUT` route above is preferred.

### Products

| Method | Endpoint | Access | Action |
| --- | --- | --- | --- |
| GET | `/api/product` | 🔓 | List products (see filtering below) |
| GET | `/api/product/:id` | 🔓 | Get one product |
| POST | `/api/product/create` | 🛡️ | Create a product (slug generated) |
| PUT | `/api/product/:id` | 🛡️ | Update a product |
| DELETE | `/api/product/:id` | 🛡️ | Delete a product |
| PUT | `/api/product/wishlist` | 🔑 | Toggle wishlist membership |
| PUT | `/api/product/rating` | 🔑 | Rate 1–5 (one rating per user) |
| PUT | `/api/product/uploads/:id` | 🛡️ | Upload images (`multipart/form-data`, field `images`) |

`GET /api/product` supports safe filtering, sorting, field selection and
pagination. Only known fields/operators are accepted; `$where` or unknown keys
return `400`.

```
GET /api/product?category=shoes&price[gte]=100&price[lte]=500&sort=-price&fields=title,price&page=2&limit=20
```

Defaults: `sort=-createdAt`, `fields=-__v`, `page=1`, `limit=12` (max `100`).
`X-Total-Count` and `X-Total-Pages` response headers carry the totals.

### Blogs and blog categories

| Method | Endpoint | Access | Action |
| --- | --- | --- | --- |
| GET | `/api/blog` | 🔓 | List blogs |
| GET | `/api/blog/:id` | 🔓 | Get a blog (increments `numViews`) |
| POST | `/api/blog/create` | 🛡️ | Create a blog |
| PUT | `/api/blog/:id` | 🛡️ | Update a blog |
| DELETE | `/api/blog/:id` | 🛡️ | Delete a blog |
| PUT | `/api/blog/likes` | 🔑 | Toggle the current user's like |
| PUT | `/api/blog/dislikes` | 🔑 | Toggle the current user's dislike |
| PUT | `/api/blog/uploads/:id` | 🛡️ | Upload blog images |
| GET | `/api/blog/category`, `/api/blog/category/all`, `/api/blog/category/:id` | 🔓 | Read blog categories |
| POST | `/api/blog/category/create`, PUT/DELETE `/api/blog/category/:id` | 🛡️ | Manage blog categories |

### Categories, brands, colors, coupons, enquiries

| Method | Endpoint | Access | Action |
| --- | --- | --- | --- |
| GET | `/api/category`, `/api/category/all`, `/api/category/:id` | 🔓 | Read product categories |
| POST | `/api/category/create`, PUT/DELETE `/api/category/:id` | 🛡️ | Manage product categories |
| GET | `/api/brand`, `/api/brand/all`, `/api/brand/:id` | 🔓 | Read brands |
| POST | `/api/brand/create`, PUT/DELETE `/api/brand/:id` | 🛡️ | Manage brands |
| GET | `/api/color`, `/api/color/:id` | 🔓 | Read colors |
| POST | `/api/color`, PUT/DELETE `/api/color/:id` | 🛡️ | Manage colors |
| GET | `/api/coupon`, `/api/coupon/name/:name`, `/api/coupon/:id` | 🛡️ | Read coupons |
| POST | `/api/coupon/create`, PUT/DELETE `/api/coupon/:id` | 🛡️ | Manage coupons |
| POST | `/api/enquiry` | 🔓 | Submit an enquiry |
| GET | `/api/enquiry`, `/api/enquiry/:id` | 🛡️ | Read enquiries (personal data) |
| PUT/DELETE | `/api/enquiry/:id` | 🛡️ | Update / delete an enquiry |

### Uploads and payments

| Method | Endpoint | Access | Action |
| --- | --- | --- | --- |
| POST | `/api/uploads` | 🛡️ | Upload images, returns `[{ url, asset_id, public_id }]` |
| DELETE | `/api/uploads/delete-img/:publicId` (also `/*` for ids with slashes) | 🛡️ | Delete a Cloudinary image |
| POST | `/api/orders` | 🔑 | Create a PayPal order (`{ "product": { "cost": "10.00" } }`, or `amount`) |
| POST | `/api/orders/:orderID/capture` | 🔑 | Capture a PayPal order |

Images are held in memory (max 5 MB each, max 10 files) and resized by a
Cloudinary transformation, so nothing is written to the local filesystem —
this also works on read-only/serverless hosts. `PAYPAL_MODE=live` switches the
PayPal base URL to production.

### Deployment

`vercel.json` routes every request to `index.js`, which exports the Express
app and opens one memoised MongoDB connection per warm container. Locally,
`index.js` starts `app.listen()` only when executed directly.

CI (`.github/workflows/ci.yml`) installs with `npm ci`, checks the app loads
and runs `npm test` on Node 20 and 22.

---

## What was fixed

A non-exhaustive list of the bugs addressed in this update:

- **Security / auth**: un-awaited `bcrypt.compare` accepted *any* password;
  admin login dereferenced a null user; role escalation via `register`;
  public user/enquiry listings exposed password hashes and personal data;
  password-reset tokens were returned in the HTTP response and pointed at a
  hard-coded `localhost` URL; missing/invalid tokens returned `200`; role
  updates targeted the admin instead of `:id`; `PUT /:id` shadowed
  `/save-address` and other specific routes.
- **Data integrity**: the `pre('save')` hook re-hashed already-hashed passwords
  on every save (permanent lockout); `Cart.findOneOne` did not exist;
  `Product.findOneAndUpdate(id, …)` / `findOneAndDelete(id)` passed a string as
  a filter; `populate('wishList')` referenced a field that does not exist;
  ratings read `postedBy` instead of `postedby` and wrote `totalratings`
  instead of `totalrating`; `getUserCart` returned a single line; client-
  supplied cart/order prices were trusted; uploaded image URLs were never
  persisted (a projection was used instead of an update); like/dislike sent
  multiple responses and used global flags instead of per-user arrays.
- **Startup / infra**: the error handler was registered *before* all routes;
  no 404 handler; `colors` was used without being required; `vercel.json` had
  no rewrites; `express.static("client")` pointed at a non-existent folder;
  `sharp` wrote to directories that do not exist and then deleted the file it
  had just written; `cloudinaryUploads` was imported but never exported and the
  Cloudinary callback ignored its `error` argument; `sendEmail` was wrapped as
  an Express handler and silently swallowed failures; native `bcrypt` failed to
  build on modern Node, so hashing now uses pure-JS `bcryptjs`.
- **Models / HTTP semantics**: duplicate `images` keys and three separate
  options objects in the blog schema (timestamps were never applied),
  `timestamp` typo on colors, `String` rating average, `paidAt` defaulted at
  schema definition time, required Razorpay fields on a PayPal order,
  `res.json(500).json(...)` and other double-response bugs, missing 404s,
  `NaN` pagination when `page`/`limit` were absent, unchecked filters, and
  inconsistent error statuses/stack traces.
- **Added**: central config with validation, `ApiError` + consistent error
  mapping, request-body whitelisting, safe product query builder, shared CRUD
  controller, new cart/coupon/order endpoints, `/api/health`, CORS config,
  `.env.example`, `.gitignore`, Vercel rewrites, CI, and a 46-test regression
  suite that needs no database. `npm audit` reports **0** vulnerabilities
  across all dependencies.

## Technologies

[Node.js](https://nodejs.org/) · [Express](https://expressjs.com/) ·
[MongoDB / Mongoose](https://www.mongodb.com/) · [JWT](https://jwt.io/) ·
[Cloudinary](https://cloudinary.com/) · [PayPal Orders v2](https://developer.paypal.com/docs/api/orders/v2/) ·
[Nodemailer](https://nodemailer.com/) · [node:test](https://nodejs.org/api/test.html)
