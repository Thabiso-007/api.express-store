const express = require("express");
const router = express.Router();

const { uploads } = require("../../controllers/upload-controller/uploadController");
const { isAdmin, authMiddleWare } = require("../../middleware/authMiddleware");
const { uploadPhoto, validateImages } = require("../../middleware/uploadsImages");

router.post(
  "/",
  authMiddleWare,
  isAdmin,
  uploadPhoto.array("images", 10),
  validateImages,
  uploads.uploadImages
);

// Cloudinary public ids may contain slashes, hence the wildcard route.
router.delete("/delete-img/*", authMiddleWare, isAdmin, uploads.deleteImages);
router.delete("/delete-img/:id", authMiddleWare, isAdmin, uploads.deleteImages);

module.exports = router;
