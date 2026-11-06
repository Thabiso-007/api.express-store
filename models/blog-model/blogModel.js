const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    numViews: { type: Number, default: 0 },
    // Kept for backwards compatibility with existing clients; likeBlog /
    // dislikeBlog keep them in sync with the likes / dislikes arrays.
    isLiked: { type: Boolean, default: false },
    isDisliked: { type: Boolean, default: false },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    images: [
      {
        public_id: String,
        url: String,
      },
    ],
    author: { type: String, default: "Admin" },
  },
  {
    // All options must live in ONE object. The original passed three separate
    // objects, so `timestamps` was silently ignored, and `images` was declared
    // twice (a String then an Array).
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = mongoose.model("Blog", blogSchema);
