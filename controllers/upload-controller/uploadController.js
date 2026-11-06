const asyncHandler = require("express-async-handler");

const { cloudinaryUploadImg, cloudinaryDeleteImg } = require("../../utils/cloudinary");
const ApiError = require("../../utils/apiError");

const uploads = {
  uploadImages: asyncHandler(async (req, res) => {
    const files = req.files || [];
    if (files.length === 0) throw ApiError.badRequest("No images were uploaded");

    const images = [];
    for (const file of files) {
      images.push(await cloudinaryUploadImg(file.buffer, { folder: "express-store/products" }));
    }
    res.status(200).json(images);
  }),

  deleteImages: asyncHandler(async (req, res) => {
    // Public ids often contain a folder slash, which `:id` cannot capture.
    const publicId = decodeURIComponent(req.params[0] || req.params.id || "");
    if (!publicId) throw ApiError.badRequest("A public_id is required");
    const result = await cloudinaryDeleteImg(publicId);
    res.status(200).json({ message: "Deleted", result });
  }),
};

module.exports = { uploads };
