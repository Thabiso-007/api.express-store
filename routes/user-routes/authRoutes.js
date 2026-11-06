const express = require("express");
const router = express.Router();

const { user } = require("../../controllers/user-controller/userController");
const { authMiddleWare, isAdmin } = require("../../middleware/authMiddleware");

// --- Public ---------------------------------------------------------------
router.post("/register", user.register);
router.post("/login", user.login);
router.post("/admin-login", user.Adminlogin);
router.post("/forgot-password-token", user.forgotPasswordToken);
router.get("/refresh", user.handleRefreshToken);
router.get("/logout", user.logout);
router.put("/reset-password/:token", user.resetPassword);

// --- Authenticated --------------------------------------------------------
router.post("/cart", authMiddleWare, user.userCart);
router.post("/cart/apply-coupon", authMiddleWare, user.applyCoupon);
router.post("/cart/create-order", authMiddleWare, user.createOrder);

router.get("/cart", authMiddleWare, user.getUserCart);
router.get("/wishlist", authMiddleWare, user.getWishList);
router.get("/get-orders", authMiddleWare, user.getOrders);

router.put("/save-address", authMiddleWare, user.saveAddress);
router.put("/update-password", authMiddleWare, user.updatePassword);
router.put("/update-user", authMiddleWare, user.updateUser);
// Correct verb for changing a cart line quantity.
router.put("/cart/:cartItemId/:newQuantity", authMiddleWare, user.updateProductQuantityFromCart);

router.delete("/empty-cart", authMiddleWare, user.emptyCart);
router.delete("/delete-product-cart/:cartItemId", authMiddleWare, user.deleteProductFromCart);
// Legacy alias kept for existing clients.
router.delete("/update-product-cart/:cartItemId/:newQuantity", authMiddleWare, user.updateProductQuantityFromCart);

// --- Admin ----------------------------------------------------------------
router.get("/all", authMiddleWare, isAdmin, user.getAllUsers);
router.get("/all-orders", authMiddleWare, isAdmin, user.getAllOrders);
router.put("/role/:id", authMiddleWare, isAdmin, user.updateRole);
router.put("/order/update-order/:id", authMiddleWare, isAdmin, user.updateOrderStatus);
router.put("/blocked-user/:id", authMiddleWare, isAdmin, user.blockUser);
router.put("/unblocked-user/:id", authMiddleWare, isAdmin, user.unblockUser);

// --- Parameterised routes MUST come last ----------------------------------
router.get("/:id", authMiddleWare, user.getSingleUser);
router.put("/:id", authMiddleWare, user.updateUserById);
router.delete("/:id", authMiddleWare, user.deleteSingleUser);

module.exports = router;
