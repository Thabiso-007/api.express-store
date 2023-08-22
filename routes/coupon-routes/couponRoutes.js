const express = require('express');
const router = express.Router();

const { coupon } = require('../../controllers/coupon-controller/couponController');
const { isAdmin, authMiddleWare  } = require('../../middleware/authMiddleware');

router.post('/create', authMiddleWare, isAdmin, coupon.createCoupon);

router.get('/', authMiddleWare, isAdmin, coupon.getAllCoupons);

router.put('/:id', authMiddleWare, isAdmin, coupon.updateCoupon);

router.delete('/:id', authMiddleWare, isAdmin, coupon.deleteCoupon);

module.exports = router;