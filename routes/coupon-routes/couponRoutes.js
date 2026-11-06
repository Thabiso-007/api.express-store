const express = require("express");
const router = express.Router();

const { coupon } = require("../../controllers/coupon-controller/couponController");
const { isAdmin, authMiddleWare } = require("../../middleware/authMiddleware");

router.post("/create", authMiddleWare, isAdmin, coupon.create);
router.get("/", authMiddleWare, isAdmin, coupon.getAll);
router.get("/name/:name", authMiddleWare, isAdmin, coupon.getCouponByName);
router.get("/:id", authMiddleWare, isAdmin, coupon.getById);
router.put("/:id", authMiddleWare, isAdmin, coupon.update);
router.delete("/:id", authMiddleWare, isAdmin, coupon.remove);

module.exports = router;
