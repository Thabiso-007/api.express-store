const express = require("express");
const router = express.Router();

const { payment } = require("../../controllers/payment-controller/paymentController");
const { authMiddleWare } = require("../../middleware/authMiddleware");

router.post("/", authMiddleWare, payment.orders);
router.post("/:orderID/capture", authMiddleWare, payment.orderId);

module.exports = router;
