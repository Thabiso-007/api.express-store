const express = require("express");
const router = express.Router();

const { blog } = require("../../controllers/blog-controller/blogController");
const { isAdmin, authMiddleWare } = require("../../middleware/authMiddleware");
const { uploadPhoto, validateImages } = require("../../middleware/uploadsImages");

router.post("/create", authMiddleWare, isAdmin, blog.createBlog);
router.put("/likes", authMiddleWare, blog.likeBlog);
router.put("/dislikes", authMiddleWare, blog.dislikeBlog);
router.put(
  "/uploads/:id",
  authMiddleWare,
  isAdmin,
  uploadPhoto.array("images", 2),
  validateImages,
  blog.uploadImages
);
router.get("/", blog.getAllBlogs);
router.put("/:id", authMiddleWare, isAdmin, blog.updateBlog);
router.delete("/:id", authMiddleWare, isAdmin, blog.deleteBlog);
// Parameterised GET must come last so /category/* can be mounted separately.
router.get("/:id", blog.getBlog);

module.exports = router;
