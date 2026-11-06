const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    price: { type: Number, required: true, min: 0 },
    color: { type: mongoose.Schema.Types.ObjectId, ref: "Color" },
  },
  { timestamps: true }
);

cartSchema.index({ userId: 1, productId: 1, color: 1 });

module.exports = mongoose.model("Cart", cartSchema);
