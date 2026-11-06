require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");
const path = require("path");

const config = require("./config/env");
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

app.get("/", (req, res) => {
  res.status(200).json({
    name: "api.express-store",
    status: "running",
    docs: "https://github.com/Thabiso-007/api.express-store#readme",
  });
});

app.get("/api/health", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    database: states[mongoose.connection.readyState] || "unknown",
  });
});

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
