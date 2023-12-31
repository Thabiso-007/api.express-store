const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const uniqid = require('uniqid');

const User = require('../../models/user-model/userModel');
const Cart = require('../../models/cart-model/cartModel');
const Order = require('../../models/order-model/orderModel');
const Coupon = require('../../models/coupon-model/couponModel');
const Product = require('../../models/product-model/productModel');
const { generateToken } = require('../../utils/jwtToken');
const { generateRefreshToken } = require('../../utils/refreshToken');
const { jwt_secret } = require('../../config/env/index');
const { sendEmail } = require('../email-controller/emailController');

const user = {
    // Register a user
    register: asyncHandler(
        async (req, res) => {
            const email = req.body.email;

            const findUser = await User.findOne({email});
            if (!findUser) {
                // Create a new user
                const newUser = await User.create(req.body);
                res.status(200).json(newUser);
            } else {
                // User already exists
                res.status(409).json({ message :"User already exists" });
            }
        }
    ),

    // Login  a user
    login: asyncHandler(
        async (req, res) => {
            const { email, password } = req.body;

            // Check if user exists
            const findUser = await User.findOne({ email });
            if (findUser && findUser.isPasswordMatched(password)) {
                const refreshToken = await generateRefreshToken(findUser?._id)
                const updateUser = await User.findByIdAndUpdate(
                    findUser.id, 
                    {
                        refreshToken: refreshToken
                    },{ new: true }
                );
                res.cookie("refreshToken", refreshToken, {
                    httpOnly: true,
                    maxAge: 72 * 60 * 60 * 1000,
                });
                res.json({
                    _id: findUser?._id,
                    firstName: findUser?.firstName,
                    lastName: findUser?.lastName,
                    email: findUser?.email,
                    mobile: findUser?.mobile,
                    token: generateToken(findUser?._id)
                });
            } else {
                res.status(401).json({ message: "Invalid credentials" });
            }
        }
    ),

    // Login  an admin
    Adminlogin: asyncHandler(
        async (req, res) => {
            const { email, password } = req.body;

            // Check if user exists
            const findAdmin = await User.findOne({ email });
            if (findAdmin.role !== 'admin') return res.json({ message: "Not Authorised" });
            if (findAdmin && findAdmin.isPasswordMatched(password)) {
                const refreshToken = await generateRefreshToken(findAdmin?._id)
                const updateUser = await User.findByIdAndUpdate(
                    findAdmin.id, 
                    {
                        refreshToken: refreshToken
                    },{ new: true }
                );
                res.cookie("refreshToken", refreshToken, {
                    httpOnly: true,
                 maxAge: 72 * 60 * 60 * 1000,
                });
                res.json({
                    _id: findAdmin?._id,
                    firstName: findAdmin?.firstName,
                    lastName: findAdmin?.lastName,
                    email: findAdmin?.email,
                    mobile: findAdmin?.mobile,
                    token: generateToken(findAdmin?._id)
                });
            } else {
                res.status(401).json({ message: "Invalid credentials" });
            }
        }
    ),

    // Logout a user
    logout: asyncHandler(
        async (req, res) => {
            const cookie = req.cookies; 
            if (!cookie?.refreshToken) return res.json({ message: "No Refresh Token in Cookies" });
            const refreshToken = cookie.refreshToken;
            const user = await User.findOne({ refreshToken });
            if (!user) {
                res.clearCookie("refreshToken", {
                    httpOnly: true,
                    secure: true
                });
                return res.sendStatus(204);
            }
            await User.findOneAndUpdate(refreshToken, {
                refreshToken: ""
            });
            res.clearCookie("refreshToken", {
                httpOnly: true,
                secure: true
            });
            return res.sendStatus(204);
        }
    ),

    // Refresh token
    handleRefreshToken: asyncHandler(
        async (req, res) => {
            const cookie = req.cookies;
            if (!cookie?.refreshToken) return res.json({ message: "No Refresh Token in Cookies" });
            const refreshToken = cookie.refreshToken;
            const user = await User.findOne({ refreshToken });
            if (!user) return res.json({ message: "No refresh token is present in the database" });
            jwt.verify(refreshToken, jwt_secret, (err, decoded) => {
                if (err || user.id !== decoded.id) {
                    res.json({ message: "There is something wrong with refresh token." });
                }
                const accessToken = generateToken(user?._id);
                res.json({ accessToken });
            })
        }
    ),

    // Get all users
    getAllUsers: asyncHandler(
        async (req, res) => {
            try {
                const getUsers = await User.find();
                res.status(200).json(getUsers);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        } 
    ),

    // Get single user
    getSingleUser: asyncHandler(
        async (req, res) => {
            const { id } = req.params;
            try {
                const getUser = await User.findById(id);
                res.status(200).json({getUser});
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    ),

    // Delete a  user
    deleteSingleUser: asyncHandler(
        async (req, res) => {
            const { id } = req.params;
            try {
                const deleteUser = await User.findByIdAndDelete(id);
                res.status(200).json({deleteUser});
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    ),

    // Update a user
    updateUser: asyncHandler(
        async (req, res) => {
            //const { id } = req.params
            const { _id } = req.user;
            try {
                const updateUser = await User.findByIdAndUpdate(
                    _id,
                    {
                        firstName: req.body?.firstName,
                        lastName: req.body?.lastName,
                        email: req.body?.email,
                        mobile: req.body?.mobile
                    },{ new: true }
                );
                res.status(200).json(updateUser);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    ),

    // Update a user
    updateRole: asyncHandler(
        async (req, res) => {
            //const { id } = req.params
            const { _id } = req.user;
            try {
                const updateRole = await User.findByIdAndUpdate(
                    _id,
                    {
                        role: req.body?.role,
                    },{ new: true }
                );
                res.status(200).json(updateRole);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    ),

    // Save user Address
    saveAddress: asyncHandler(
        async (req, res, next) => {
            const { _id } = req.user;
            try {
                const updateUser = await User.findByIdAndUpdate(
                    _id,
                    {
                        address: req.body?.address,
                    },{ new: true }
                );
                res.status(200).json(updateUser);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    ),

    // Block user
    blockUser: asyncHandler(
        async (req, res) => {
            const { id } = req.params;
            try {
                const block = await User.findByIdAndUpdate(
                    id,
                    {
                        isBlocked: true
                    },{ new: true }
                );
                res.status(200).json({ message: "User blocked" });
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    ),

    // Unblock user
    unblockUser: asyncHandler( 
        async (req, res) => {
            const { id } = req.params;
            try {
                const unblock = await User.findByIdAndUpdate(
                    id,
                    {
                        isBlocked: false
                    },{ new: true }
                );
                res.status(200).json({
                    message: "User unblocked",
                });
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    ),


    // Update password
    updatePassword: asyncHandler(
        async (req, res) => {
            const { _id } = req.user;
            const { password } = req.body;

            const  user = await User.findById(_id);
            if (password) {
                user.password = password
                const updatePassword = await user.save()
                res.json(updatePassword)
            } else {
                res.json(user);
            }
        }
    ),

    // Forgot password
    forgotPasswordToken: asyncHandler(
        async (req, res) => {
            const { email } = req.body;
            const user = await User.findOne({ email });
            if (!user) return res.json({ message: "User not found with this email." });
            try {
                const token = await user.createPasswordResetToken();
                await user.save();
                const resetURL =  `Hi Please follow this link to reset your password. This link will expire in the next 10 munites. <a href='http://localhost:8888/api/user/reset-password/${token}'>Click here</a> to reset your password.`;
                const data = {
                    to: email,
                    subject: "Forgot Pasword Link",
                    html: resetURL
                };
                sendEmail(data);
                res.json(token);
            } catch(error) {
                res.status(500).json({ message: error.message });
            }
        }
    ),

    // Reset password
    resetPassword: asyncHandler(
        async (req, res) => {
            const { password } = req.body;
            const { token } = req.params;
            const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
            const user = await User.findOne({
                passwordResetToken: hashedToken,
                passwordResetExpires: { $gt: Date.now() }
            });
            if (!user) res.json({ message: "Token Expired, Please try again later" });       
            user.password = password;
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save();
            res.json(user);
        }
    ),

    // Get wish list
    getWishList: asyncHandler(
        async (req, res) => {
            const { _id } = req.user;
            try {
                const findUser = await User.findById(_id).populate('wishList');
                res.status(200).json(findUser);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    ), 

    // User cart
    userCart: asyncHandler(
        async (req, res) => {
            const { productId, color, quantity, price } = req.body;
            const { _id } = req.user;
            try {
                let newCart = await Cart({
                    userId:_id,
                    productId,
                    color,
                    price,
                    quantity
                }).save();
                res.status(200).json(newCart);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    ),

    // Fetch user cart
    getUserCart: asyncHandler(
        async (req, res) => {
            const { _id } = req.user;
            try {
                const cart = await Cart.findOne({ userId: _id }).populate("productId").populate("color");
                res.status(200).json(cart);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    ),


    // Delete single product 
    deleteProductFromCart: asyncHandler(
        async (req, res) => {
            const { _id } = req.user;
            const { cartItemId } = req.params;
            try {
                const removeProductFromCart = await Cart.deleteOne({ userId: _id, _id: cartItemId });
                res.status(200).json(removeProductFromCart);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    ),

    // Update product quantity from cart
    updateProductQuantityFromCart: asyncHandler(
        async (req, res) => {
            const { _id } = req.user;
            const { cartItemId, newQuantity } = req.params;
            try {
                const cartItem = await Cart.findOneOne({ userId: _id, _id: cartItemId });
                cartItem.quantity = newQuantity;
                cartItem.save();
                res.status(200).json(cartItem);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    ),

    // Create Order
    createOrder: asyncHandler(
        async (req, res) => {
            const { paymentInfo, orderItems, totalPrice, totalPriceAfterDiscount, shippingInfo } = req.body;
            const { _id } = req.user;
            try {
                const order = await Order.create({
                    paymentInfo, 
                    orderItems, 
                    totalPrice, 
                    totalPriceAfterDiscount, 
                    shippingInfo,
                    user: _id
                });
                res.status(201).json({
                    order,
                    success: true
                });
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    )
}

module.exports = { user }