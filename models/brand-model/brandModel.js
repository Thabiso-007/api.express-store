const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true, index: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("brand", brandSchema);
