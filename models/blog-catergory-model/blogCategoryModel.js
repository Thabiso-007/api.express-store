const mongoose = require("mongoose");

const blogCategorySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true, index: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Blog-Category", blogCategorySchema);
