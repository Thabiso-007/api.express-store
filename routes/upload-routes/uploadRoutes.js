const express = require("express");
const router = express.Router();

const { uploads } = require("../../controllers/upload-controller/uploadController")
const { isAdmin, authMiddleWare } = require("../../middleware/authMiddleware");
const { uploadPhoto, productImgResize } = require("../../middleware/uploadsImages");

router.post(
  "/",
  authMiddleWare,
  isAdmin,
  uploadPhoto.array("images", 10),
  productImgResize,
  uploads.uploadImages
);

router.delete("/delete-img/:id", authMiddleWare, isAdmin, uploads.deleteImages);

module.exports = router;