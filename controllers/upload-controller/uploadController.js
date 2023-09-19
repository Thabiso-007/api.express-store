const fs = require("fs");
const asyncHandler = require("express-async-handler");

const {
  cloudinaryUploadImg,
  cloudinaryDeleteImg,
} = require("../../utils/cloudinary");

const uploads = {
    // Uploads
    uploadImages: asyncHandler(
        async (req, res) => {
            try {
                const uploader = (path) => cloudinaryUploadImg(path, "images");
                const urls = [];
                const files = req.files;
                for (const file of files) {
                    const { path } = file;
                    const newpath = await uploader(path);
                    console.log(newpath);
                    urls.push(newpath);
                    fs.unlinkSync(path);
                }
                const images = urls.map((file) => {
                    return file;
                });
                res.json(images);
            } catch (error) {
                res.status(500).json({ message: error.message });
        }
    }),

    deleteImages: asyncHandler(
        async (req, res) => {
            const { id } = req.params;
            try {
                const deleted = cloudinaryDeleteImg(id, "images");
                res.json({ message: "Deleted" });
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        })
    }

module.exports = { uploads };