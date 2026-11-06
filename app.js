require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const swaggerUi = require("swagger-ui-express");

const config = require("./config/env");
const pkg = require("./package.json");
const openApiSpec = require("./docs/openapi");
const healthController = require("./controllers/health-controller/healthController");
const { errorHandler, notFound } = require("./middleware/errorHandler");

const authRoutes = require("./routes/user-routes/authRoutes");
const productRoutes = require("./routes/product-routes/productRoutes");
const blogRoutes = require("./routes/blog-routes/blogRoutes");
const categoryRoutes = require("./routes/category-routes/categoryRoutes");
const blogCategoryRoutes = require("./routes/blog-category-routes/blogCategoryRoutes");
const brandRoutes = require("./routes/brand-routes/brandRoutes");
const couponRoutes = require("./routes/coupon-routes/couponRoutes");
const enquiryRoutes = require("./routes/enquiry-routes/enquiryRoutes");
const colorRoutes = require("./routes/color-routes/colorRoutes");
const paymentRoutes = require("./routes/payment-routes/paymentRoutes");
const uploadRoutes = require("./routes/upload-routes/uploadRoutes");

const app = express();

if (config.isProduction) app.set("trust proxy", 1);

const allowedOrigins = config.client_url
  ? config.client_url.split(",").map((origin) => origin.trim()).filter(Boolean)
  : null;
app.use(cors({ origin: allowedOrigins || true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
if (!config.isTest) app.use(morgan("tiny"));

app.use("/images", express.static(path.join(__dirname, "public", "images")));

// ------------------------------------------------------------ System -----
app.get("/", (req, res) => {
  res.status(200).json({
    name: pkg.name,
    version: pkg.version,
    status: "running",
    docs: "/api/docs",
    openapi: "/api/docs.json",
    health: "/api/health",
    ready: "/api/health/ready",
    statusPage: "/status",
    repository: "https://github.com/Thabiso-007/api.express-store",
  });
});

app.get("/status", healthController.statusPage);
app.get("/api/health/live", healthController.live);
app.get("/api/health/ready", healthController.ready);
app.get("/api/health", healthController.health);

// ------------------------------------------------------- API docs ---------
// Raw spec is useful for codegen, Postman/Insomnia imports and monitoring.
app.get("/api/docs.json", (req, res) => res.json(openApiSpec));
// swagger-ui-express redirects /api/docs -> /api/docs/ itself; an explicit
// redirect here would also match the trailing-slash URL (Express' non-strict
// routing) and create a redirect loop.
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: "api.express-store | API docs",
    customCss: ".swagger-ui .topbar { display: none }",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
    },
  })
);

// Mount the more specific path first: blogRouter.get('/:id') would otherwise
// swallow `/api/blog/category`.
app.use("/api/blog/category", blogCategoryRoutes);
app.use("/api/user", authRoutes);
app.use("/api/product", productRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/brand", brandRoutes);
app.use("/api/coupon", couponRoutes);
app.use("/api/enquiry", enquiryRoutes);
app.use("/api/color", colorRoutes);
app.use("/api/orders", paymentRoutes);
app.use("/api/uploads", uploadRoutes);

// Error middleware must be registered AFTER all routes to catch their errors.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
