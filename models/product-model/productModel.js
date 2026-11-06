const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true },
    brand: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    sold: { type: Number, default: 0, min: 0 },
    images: [{ public_id: String, url: String }],
    color: [{ type: mongoose.Schema.Types.ObjectId, ref: "Color" }],
    tags: String,
    ratings: [
      {
        star: { type: Number, min: 1, max: 5 },
        comment: String,
        // Keep the original (lowercase) field name so existing ratings stay
        // readable. All controller code now uses `postedby` consistently.
        postedby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
    // A rating is a number, not a String.
    totalrating: { type: Number, default: 0, min: 0, max: 5 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
