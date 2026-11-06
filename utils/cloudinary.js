const cloudinary = require("cloudinary").v2;

const config = require("../config/env");
const ApiError = require("./apiError");

let configured = false;
const ensureConfigured = () => {
  if (!config.cloud_name || !config.cloud_api_key || !config.cloud_api_secret) {
    throw new ApiError(
      503,
      "Image uploads are not configured. Set CLOUD_NAME, CLOUD_API_KEY and CLOUD_API_SECRET."
    );
  }
  if (configured) return;
  cloudinary.config({
    cloud_name: config.cloud_name,
    api_key: config.cloud_api_key,
    api_secret: config.cloud_api_secret,
    secure: true,
  });
  configured = true;
};

const formatResult = (result) => ({
  url: result.secure_url,
  asset_id: result.asset_id,
  public_id: result.public_id,
});

/** Upload a multer file (a Buffer from memoryStorage) or a local path. */
const cloudinaryUploadImg = async (input, options = {}) => {
  ensureConfigured();
  // Legacy callers passed a folder name as the second argument.
  if (typeof options === "string") options = { folder: options };
  const uploadOptions = {
    resource_type: "auto",
    folder: options.folder || "express-store",
    // Server-side resize replaces the old (broken) sharp middleware: that
    // middleware wrote into a non-existent directory and then deleted the
    // file it had just written.
    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
    ...options,
  };

  let result;
  if (Buffer.isBuffer(input)) {
    result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, response) => (error ? reject(error) : resolve(response))
      );
      stream.on("error", reject);
      stream.end(input);
    });
  } else {
    result = await cloudinary.uploader.upload(input, uploadOptions);
  }
  return formatResult(result);
};

const cloudinaryDeleteImg = async (publicId) => {
  ensureConfigured();
  if (!publicId) throw ApiError.badRequest("A public_id is required");
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });
  if (result?.result !== "ok") {
    throw ApiError.notFound("Image not found on Cloudinary");
  }
  return result;
};

module.exports = {
  cloudinaryUploadImg,
  cloudinaryDeleteImg,
  // Backwards-compatible alias for code that used the old, non-existent name.
  cloudinaryUploads: cloudinaryUploadImg,
};
