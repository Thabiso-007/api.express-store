const mongoose = require("mongoose");

const colorSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true, index: true, trim: true },
  },
  // `timestamp` (singular) was a typo: no createdAt/updatedAt were added.
  { timestamps: true }
);

module.exports = mongoose.model("Color", colorSchema);
