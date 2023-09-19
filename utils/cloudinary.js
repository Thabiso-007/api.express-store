const cloudinary = require('cloudinary');

const { cloud_name, cloud_api_key, cloud_api_secret } = require('../config/env');

cloudinary.config({
    cloud_name: cloud_name,
    api_key: cloud_api_key,
    api_secret: cloud_api_secret,
  });
  

const cloudinaryUploadImg = async (fileToUploads) => {
    return new Promise((resolve) => {
        cloudinary.uploader.upload(fileToUploads, (result) => {
            resolve(
            {
                url: result.secure_url,
                asset_id: result.asset_id,
                public_id: result.public_id,
            },
            {
                resource_type: "auto",
            });
        });
    });
};

const cloudinaryDeleteImg = async (fileToDelete) => {
    return new Promise((resolve) => {
        cloudinary.uploader.destroy(fileToDelete, (result) => {
            resolve(
            {
                url: result.secure_url,
                asset_id: result.asset_id,
                public_id: result.public_id,
            },
            {
                resource_type: "auto",
            });
        });
    });
};
  
module.exports = { cloudinaryUploadImg, cloudinaryDeleteImg };