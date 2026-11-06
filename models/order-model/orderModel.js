const mongoose = require("mongoose");

const ORDER_STATUSES = ["Ordered", "Processing", "Shipped", "Delivered", "Cancelled"];

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    shippingInfo: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      other: { type: String },
      pincode: { type: String, required: true },
    },
    // PayPal is the configured gateway, so Razorpay ids must not be required.
    paymentInfo: {
      paypalOrderId: String,
      paypalPaymentId: String,
      razorpayOrderId: String,
      razorpayPaymentId: String,
      method: { type: String, default: "PayPal" },
    },
    orderItems: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        color: { type: mongoose.Schema.Types.ObjectId, ref: "Color" },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
      },
    ],
    paidAt: { type: Date, default: Date.now },
    totalPrice: { type: Number, required: true, min: 0 },
    totalPriceAfterDiscount: { type: Number, required: true, min: 0 },
    coupon: String,
    orderStatus: { type: String, enum: ORDER_STATUSES, default: "Ordered" },
  },
  { timestamps: true }
);

orderSchema.statics.ORDER_STATUSES = ORDER_STATUSES;

module.exports = mongoose.model("Order", orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
