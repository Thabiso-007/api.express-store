const asyncHandler = require("express-async-handler");

const createCrudController = require("../../utils/crudController");
const Coupon = require("../../models/coupon-model/couponModel");
const ApiError = require("../../utils/apiError");

const coupon = createCrudController(Coupon, {
  label: "Coupon",
  fields: ["name", "expiry", "discount"],
});

/** Look up a coupon by name (used by the cart when applying a discount). */
coupon.getCouponByName = asyncHandler(async (req, res) => {
  const name = String(req.params.name || "").trim().toUpperCase();
  const found = await Coupon.findOne({ name });
  if (!found) throw ApiError.notFound("Coupon not found");
  if (new Date(found.expiry).getTime() < Date.now()) {
    throw ApiError.badRequest("This coupon has expired");
  }
  res.status(200).json(found);
});

coupon.createCoupon = coupon.create;
coupon.getAllCoupons = coupon.getAll;
coupon.updateCoupon = coupon.update;
coupon.deleteCoupon = coupon.remove;

module.exports = { coupon };
