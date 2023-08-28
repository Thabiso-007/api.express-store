const express = require('express');
const router = express.Router();

const { payment } = require('../../controllers/payment-controller/paymentController');
const { authMiddleWare  } = require('../../middleware/authMiddleware');

router.post('/', authMiddleWare, payment.orders);
router.post('/:orderID/capture', authMiddleWare, payment.orderId);

// TODO https://developer.paypal.com/docs/api/orders/v2/, Once you are done with the frontend, present both the orders and updated orders.
// TODO 
module.exports = router;