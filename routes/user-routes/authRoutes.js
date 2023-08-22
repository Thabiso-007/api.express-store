const express = require('express');
const router = express.Router();

const { user } = require('../../controllers/user-controller/userController');
const { authMiddleWare, isAdmin } = require('../../middleware/authMiddleware');

router.post('/cart', authMiddleWare, user.userCart);
router.post('/register', user.register);
router.post('/login', user.login);
router.post('/admin-login', user.Adminlogin);
router.post('/forgot-password-token', user.forgotPasswordToken);
// router.post('/cart/apply-coupon', authMiddleWare, user.applyCoupon);
router.post('/cart/create-order', authMiddleWare, user.createOrder);

router.get('/refresh', user.handleRefreshToken);
router.get('/logout', user.logout);
router.get('/all', user.getAllUsers);
router.get('/cart', authMiddleWare, user.getUserCart);
router.get('/wishlist', authMiddleWare, user.getWishList);
// router.get('/get-orders', authMiddleWare, user.getOrders);
router.get('/:id' ,authMiddleWare, user.getSingleUser);

// router.put('/order/update-order/:id', authMiddleWare, isAdmin, user.updateOrderStatus);
router.put('/reset-password/:token', user.resetPassword);

// router.delete('/empty-cart', authMiddleWare, emptyCart);
router.delete('/delete-product-cart/:cartItemId', authMiddleWare, user.deleteProductFromCart);
router.delete('/update-product-cart/:cartItemId/:newQuantity', authMiddleWare, user.updateProductQuantityFromCart);
router.delete('/:id', user.deleteSingleUser);

router.put('/save-address', authMiddleWare, user.saveAddress);
router.put('/update-password', authMiddleWare, user.updatePassword);
router.put('/update-user', authMiddleWare, user.updateUser);
router.put('/blocked-user/:id', authMiddleWare, isAdmin, user.blockUser);
router.put('/unblocked-user/:id', authMiddleWare, isAdmin, user.unblockUser);

module.exports = router;
