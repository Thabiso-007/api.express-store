const multer = require("multer");

const ApiError = require("../utils/apiError");

/**
 * Keep uploaded files in memory. The previous diskStorage wrote to
 * public/images and the sharp middleware then tried to write to directories
 * that do not exist, before deleting the file it had just written. Memory
 * storage also works on read-only/serverless filesystems (Vercel).
 */
const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype?.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(ApiError.badRequest("Unsupported file format"), false);
    }
  },
});

const validateImages = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next(ApiError.badRequest("No images were uploaded"));
  }
  next();
};

// Kept as aliases for backwards compatibility. Resizing now happens as a
// Cloudinary transformation at upload time (see utils/cloudinary.js).
const productImgResize = validateImages;
const blogImgResize = validateImages;

module.exports = { uploadPhoto, validateImages, productImgResize, blogImgResize };
