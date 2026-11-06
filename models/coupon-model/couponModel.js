const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, uppercase: true, trim: true },
    expiry: { type: Date, required: true },
    discount: { type: Number, required: true, min: 1, max: 100 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("coupon", couponSchema);
