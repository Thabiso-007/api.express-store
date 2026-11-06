const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const User = require("../../models/user-model/userModel");
const Cart = require("../../models/cart-model/cartModel");
const Order = require("../../models/order-model/orderModel");
const Coupon = require("../../models/coupon-model/couponModel");
const Product = require("../../models/product-model/productModel");
const { ORDER_STATUSES } = require("../../models/order-model/orderModel");
const { generateToken } = require("../../utils/jwtToken");
const { generateRefreshToken } = require("../../utils/refreshToken");
const config = require("../../config/env");
const { sendEmail } = require("../email-controller/emailController");
const ApiError = require("../../utils/apiError");
const {
  assertObjectId,
  pick,
  requireFields,
  normalizeEmail,
  isEmail,
  parseIntInRange,
} = require("../../utils/helpers");

const SAFE_USER_FIELDS =
  "-password -refreshToken -passwordResetToken -passwordResetExpires -__v";
const WRITABLE_USER_FIELDS = ["firstName", "lastName", "email", "mobile"];
const round2 = (value) => Math.round(value * 100) / 100;

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.isProduction,
  sameSite: config.isProduction ? "none" : "lax",
  maxAge: config.refresh_cookie_max_age,
  path: "/",
});

// clearCookie must NOT receive maxAge: Express would recompute a *future*
// expires value and the browser would keep the cookie.
const clearCookieOptions = () => {
  const { maxAge, ...options } = cookieOptions();
  return options;
};

const publicUser = (user) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  mobile: user.mobile,
  role: user.role,
  isBlocked: user.isBlocked,
});

const assertSelfOrAdmin = (req, id) => {
  if (String(req.user._id) !== String(id) && req.user.role !== "admin") {
    throw ApiError.forbidden("You can only manage your own account");
  }
};

const assertNonEmptyPassword = (password) => {
  if (typeof password !== "string" || password.length < 6) {
    throw ApiError.badRequest("Password must be at least 6 characters long");
  }
};

const updateUserFields = async (id, payload) => {
  if (Object.keys(payload).length === 0) {
    throw ApiError.badRequest("No updatable fields supplied");
  }
  if (payload.email !== undefined) {
    payload.email = normalizeEmail(payload.email);
    if (!isEmail(payload.email)) throw ApiError.badRequest("Invalid email address");
  }
  const updated = await User.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  }).select(SAFE_USER_FIELDS);
  if (!updated) throw ApiError.notFound("User not found");
  return updated;
};

/** Shared login implementation for users and admins. */
const loginWithPassword = async (req, res, requireAdmin) => {
  requireFields(req.body, ["email", "password"]);
  const email = normalizeEmail(req.body.email);
  const found = await User.findOne({ email });
  if (!found) throw ApiError.unauthorized("Invalid credentials");

  // This MUST be awaited: without await a Promise is truthy and *any*
  // password used to be accepted.
  const matched = await found.isPasswordMatched(req.body.password);
  if (!matched) throw ApiError.unauthorized("Invalid credentials");
  if (found.isBlocked) throw ApiError.forbidden("This account has been blocked");
  if (requireAdmin && found.role !== "admin") {
    throw ApiError.forbidden("Not Authorised");
  }

  const refreshToken = generateRefreshToken(found._id);
  await User.findByIdAndUpdate(found._id, { refreshToken });
  res.cookie("refreshToken", refreshToken, cookieOptions());
  res.status(200).json({
    ...publicUser(found),
    token: generateToken(found._id),
  });
};

const user = {
  // Register a user (role / isBlocked / wishlist can never be set by a client)
  register: asyncHandler(async (req, res) => {
    requireFields(req.body, ["firstName", "lastName", "email", "mobile", "password"]);
    if (!isEmail(normalizeEmail(req.body.email))) {
      throw ApiError.badRequest("Invalid email address");
    }
    assertNonEmptyPassword(req.body.password);

    const payload = pick(req.body, [...WRITABLE_USER_FIELDS, "password"]);
    payload.email = normalizeEmail(payload.email);
    payload.mobile = String(payload.mobile).trim();

    const existing = await User.findOne({
      $or: [{ email: payload.email }, { mobile: payload.mobile }],
    });
    if (existing) throw ApiError.conflict("User already exists");

    const newUser = await User.create(payload);
    res.status(201).json(newUser);
  }),

  login: asyncHandler((req, res) => loginWithPassword(req, res, false)),
  Adminlogin: asyncHandler((req, res) => loginWithPassword(req, res, true)),

  // Logout: clear the refresh token in the DB and in the browser
  logout: asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      // The original passed the token string as the *filter* to
      // findOneAndUpdate, which never matched a document.
      await User.updateOne({ refreshToken }, { $unset: { refreshToken: 1 } });
    }
    res.clearCookie("refreshToken", clearCookieOptions());
    res.status(204).end();
  }),

  // Issue a new access token from the httpOnly refresh cookie
  handleRefreshToken: asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw ApiError.unauthorized("No Refresh Token in Cookies");
    }
    const found = await User.findOne({ refreshToken });
    if (!found) {
      throw ApiError.forbidden("No refresh token is present in the database");
    }
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt_secret);
    } catch {
      throw ApiError.forbidden("There is something wrong with the refresh token");
    }
    // The original forgot to `return` on failure and sent two responses,
    // causing ERR_HTTP_HEADERS_SENT.
    if (String(decoded?.id) !== String(found._id)) {
      throw ApiError.forbidden("There is something wrong with the refresh token");
    }
    const accessToken = generateToken(found._id);
    res.status(200).json({ accessToken, token: accessToken });
  }),

  // Admin only (protected in the router); never expose password hashes
  getAllUsers: asyncHandler(async (req, res) => {
    const users = await User.find().select(SAFE_USER_FIELDS);
    res.status(200).json(users);
  }),

  getSingleUser: asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, "user id");
    assertSelfOrAdmin(req, id);
    const found = await User.findById(id).select(SAFE_USER_FIELDS);
    if (!found) throw ApiError.notFound("User not found");
    res.status(200).json(found);
  }),

  deleteSingleUser: asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, "user id");
    assertSelfOrAdmin(req, id);
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) throw ApiError.notFound("User not found");
    res.status(200).json(deleted);
  }),

  updateUser: asyncHandler(async (req, res) => {
    const updated = await updateUserFields(
      req.user._id,
      pick(req.body, WRITABLE_USER_FIELDS)
    );
    res.status(200).json(updated);
  }),

  // Legacy PUT /api/user/:id now honours the id (self or admin only).
  updateUserById: asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, "user id");
    assertSelfOrAdmin(req, id);
    const updated = await updateUserFields(id, pick(req.body, WRITABLE_USER_FIELDS));
    res.status(200).json(updated);
  }),

  // Update the role of the user in :id, not the admin making the request
  updateRole: asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, "user id");
    const role = req.body?.role;
    if (!["user", "admin"].includes(role)) {
      throw ApiError.badRequest("role must be either 'user' or 'admin'");
    }
    const updated = await User.findByIdAndUpdate(id, { role }, {
      new: true,
      runValidators: true,
    }).select(SAFE_USER_FIELDS);
    if (!updated) throw ApiError.notFound("User not found");
    res.status(200).json(updated);
  }),

  saveAddress: asyncHandler(async (req, res) => {
    requireFields(req.body, ["address"]);
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { address: req.body.address },
      { new: true, runValidators: true }
    ).select(SAFE_USER_FIELDS);
    if (!updated) throw ApiError.notFound("User not found");
    res.status(200).json(updated);
  }),

  blockUser: asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, "user id");
    if (String(id) === String(req.user._id)) {
      throw ApiError.badRequest("You cannot block your own account");
    }
    const blocked = await User.findByIdAndUpdate(id, { isBlocked: true }, { new: true });
    if (!blocked) throw ApiError.notFound("User not found");
    res.status(200).json({ message: "User blocked", user: publicUser(blocked) });
  }),

  unblockUser: asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, "user id");
    const unblocked = await User.findByIdAndUpdate(id, { isBlocked: false }, { new: true });
    if (!unblocked) throw ApiError.notFound("User not found");
    res.status(200).json({ message: "User unblocked", user: publicUser(unblocked) });
  }),

  updatePassword: asyncHandler(async (req, res) => {
    requireFields(req.body, ["password"]);
    assertNonEmptyPassword(req.body.password);
    const found = await User.findById(req.user._id);
    if (!found) throw ApiError.notFound("User not found");
    if (req.body.currentPassword) {
      const matched = await found.isPasswordMatched(req.body.currentPassword);
      if (!matched) throw ApiError.unauthorized("Current password is incorrect");
    }
    found.password = req.body.password;
    await found.save(); // pre-save hook hashes exactly once
    res.status(200).json({ message: "Password updated", user: publicUser(found) });
  }),

  // Forgot password: e-mail the token, never return it in the response
  forgotPasswordToken: asyncHandler(async (req, res) => {
    requireFields(req.body, ["email"]);
    const email = normalizeEmail(req.body.email);
    const success = {
      message: "If an account exists for that email, a reset link has been sent",
    };
    const found = await User.findOne({ email });
    if (!found) return res.status(200).json(success);

    const resetToken = found.createPasswordResetToken();
    await found.save();
    const baseUrl = config.app_url.replace(/\/+$/, "");
    const resetUrl = `${baseUrl}/reset-password/${encodeURIComponent(resetToken)}`;
    const html =
      `Hi, please follow this link to reset your password. ` +
      `The link expires in 10 minutes. <a href="${resetUrl}">Reset password</a>`;
    await sendEmail({
      to: email,
      subject: "Reset your password",
      html,
      text: `Reset your password (link expires in 10 minutes): ${resetUrl}`,
    });
    if (!config.isProduction) console.info(`[password reset] ${resetUrl}`);
    res.status(200).json(success);
  }),

  resetPassword: asyncHandler(async (req, res) => {
    requireFields(req.body, ["password"]);
    assertNonEmptyPassword(req.body.password);
    const hashedToken = crypto
      .createHash("sha256")
      .update(String(req.params.token))
      .digest("hex");
    const found = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });
    // The original sent a response here but did not return, then dereferenced
    // `user.password` on null and crashed the process.
    if (!found) throw ApiError.badRequest("Token expired, please try again later");

    found.password = req.body.password;
    found.passwordResetToken = undefined;
    found.passwordResetExpires = undefined;
    await found.save();
    res.status(200).json({ message: "Password reset successful" });
  }),

  // Schema field is `wishlist`; the old `populate('wishList')` never populated
  getWishList: asyncHandler(async (req, res) => {
    const found = await User.findById(req.user._id)
      .populate("wishlist")
      .select(SAFE_USER_FIELDS);
    if (!found) throw ApiError.notFound("User not found");
    res.status(200).json(found);
  }),

  // Add/update a cart item. Price is read from the DB, never trusted from the
  // request body, and duplicate items are merged instead of duplicated.
  userCart: asyncHandler(async (req, res) => {
    requireFields(req.body, ["productId", "quantity"]);
    const productId = assertObjectId(req.body.productId, "product id");
    const quantity = parseIntInRange(req.body.quantity, {
      field: "quantity",
      min: 1,
      max: 999,
    });
    const color = req.body.color
      ? assertObjectId(req.body.color, "color id")
      : undefined;
    const foundProduct = await Product.findById(productId);
    if (!foundProduct) throw ApiError.notFound("Product not found");
    if (Number(foundProduct.quantity) < quantity) {
      throw ApiError.badRequest("Insufficient stock");
    }

    const filter = { userId: req.user._id, productId, color };
    const cartItem = await Cart.findOneAndUpdate(
      filter,
      { $set: { price: Number(foundProduct.price), quantity } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(cartItem);
  }),

  getUserCart: asyncHandler(async (req, res) => {
    // findOne() returned only a single cart line; a cart has many lines.
    const cart = await Cart.find({ userId: req.user._id })
      .populate("productId")
      .populate("color");
    res.status(200).json(cart);
  }),

  emptyCart: asyncHandler(async (req, res) => {
    const result = await Cart.deleteMany({ userId: req.user._id });
    res.status(200).json({ deletedCount: result?.deletedCount ?? 0, success: true });
  }),

  deleteProductFromCart: asyncHandler(async (req, res) => {
    const cartItemId = assertObjectId(req.params.cartItemId, "cart item id");
    const removed = await Cart.findOneAndDelete({
      _id: cartItemId,
      userId: req.user._id,
    });
    if (!removed) throw ApiError.notFound("Cart item not found");
    res.status(200).json(removed);
  }),

  // `Cart.findOneOne` did not exist and threw on every call
  updateProductQuantityFromCart: asyncHandler(async (req, res) => {
    const cartItemId = assertObjectId(req.params.cartItemId, "cart item id");
    const quantity = parseIntInRange(req.params.newQuantity, {
      field: "newQuantity",
      min: 1,
      max: 999,
    });
    const cartItem = await Cart.findOne({
      _id: cartItemId,
      userId: req.user._id,
    });
    if (!cartItem) throw ApiError.notFound("Cart item not found");
    cartItem.quantity = quantity;
    await cartItem.save();
    res.status(200).json(cartItem);
  }),

  applyCoupon: asyncHandler(async (req, res) => {
    requireFields(req.body, ["coupon"]);
    const name = String(req.body.coupon).trim().toUpperCase();
    const coupon = await Coupon.findOne({ name });
    if (!coupon) throw ApiError.notFound("Coupon not found");
    if (new Date(coupon.expiry).getTime() < Date.now()) {
      throw ApiError.badRequest("This coupon has expired");
    }
    const items = await Cart.find({ userId: req.user._id });
    const cartTotal = round2(
      items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0)
    );
    if (cartTotal <= 0) throw ApiError.badRequest("Your cart is empty");
    const discountAmount = round2((cartTotal * Number(coupon.discount)) / 100);
    res.status(200).json({
      coupon: coupon.name,
      discount: coupon.discount,
      cartTotal,
      discountAmount,
      totalAfterDiscount: round2(cartTotal - discountAmount),
    });
  }),

  // Create an order with server-side prices and stock checks
  createOrder: asyncHandler(async (req, res) => {
    requireFields(req.body, ["shippingInfo", "orderItems"]);
    const shippingInfo = pick(req.body.shippingInfo, [
      "firstName",
      "lastName",
      "address",
      "city",
      "state",
      "other",
      "pincode",
    ]);
    requireFields(shippingInfo, [
      "firstName",
      "lastName",
      "address",
      "city",
      "state",
      "pincode",
    ]);
    if (!Array.isArray(req.body.orderItems) || req.body.orderItems.length === 0) {
      throw ApiError.badRequest("orderItems must be a non-empty array");
    }

    const quantities = new Map();
    const rawItems = req.body.orderItems.map((item) => {
      const productId = assertObjectId(item.product, "product id");
      const quantity = parseIntInRange(item.quantity, {
        field: "quantity",
        min: 1,
        max: 999,
      });
      quantities.set(productId, (quantities.get(productId) || 0) + quantity);
      return { productId, quantity, color: item.color };
    });

    const products = await Product.find({ _id: { $in: [...quantities.keys()] } });
    const productMap = new Map(products.map((p) => [String(p._id), p]));
    for (const [productId, quantity] of quantities) {
      const found = productMap.get(productId);
      if (!found) throw ApiError.notFound("Product not found");
      if (Number(found.quantity) < quantity) {
        throw ApiError.badRequest(`Insufficient stock for ${found.title}`);
      }
    }

    const orderItems = rawItems.map((item) => ({
      product: item.productId,
      ...(item.color ? { color: item.color } : {}),
      quantity: item.quantity,
      price: Number(productMap.get(item.productId).price),
    }));
    const totalPrice = round2(
      orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    );

    let totalPriceAfterDiscount = totalPrice;
    let appliedCoupon;
    if (req.body.coupon) {
      const coupon = await Coupon.findOne({
        name: String(req.body.coupon).trim().toUpperCase(),
      });
      if (!coupon) throw ApiError.notFound("Coupon not found");
      if (new Date(coupon.expiry).getTime() < Date.now()) {
        throw ApiError.badRequest("This coupon has expired");
      }
      totalPriceAfterDiscount = round2(
        totalPrice - (totalPrice * Number(coupon.discount)) / 100
      );
      appliedCoupon = coupon.name;
    }

    const order = await Order.create({
      user: req.user._id,
      shippingInfo,
      orderItems,
      totalPrice,
      totalPriceAfterDiscount,
      ...(appliedCoupon ? { coupon: appliedCoupon } : {}),
      paymentInfo: pick(req.body.paymentInfo || {}, [
        "paypalOrderId",
        "paypalPaymentId",
        "razorpayOrderId",
        "razorpayPaymentId",
        "method",
      ]),
    });

    await Product.bulkWrite(
      [...quantities.entries()].map(([productId, quantity]) => ({
        updateOne: {
          filter: { _id: productId },
          update: { $inc: { quantity: -quantity, sold: quantity } },
        },
      }))
    );
    await Cart.deleteMany({ userId: req.user._id });

    res.status(201).json({ order, success: true });
  }),

  getOrders: asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id })
      .sort("-createdAt")
      .populate("orderItems.product");
    res.status(200).json(orders);
  }),

  getAllOrders: asyncHandler(async (req, res) => {
    const orders = await Order.find()
      .sort("-createdAt")
      .populate("user", "firstName lastName email");
    res.status(200).json(orders);
  }),

  updateOrderStatus: asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, "order id");
    const orderStatus = req.body?.orderStatus;
    if (!ORDER_STATUSES.includes(orderStatus)) {
      throw ApiError.badRequest(
        `orderStatus must be one of: ${ORDER_STATUSES.join(", ")}`
      );
    }
    const updated = await Order.findByIdAndUpdate(id, { orderStatus }, {
      new: true,
      runValidators: true,
    });
    if (!updated) throw ApiError.notFound("Order not found");
    res.status(200).json(updated);
  }),
};

module.exports = { user };
