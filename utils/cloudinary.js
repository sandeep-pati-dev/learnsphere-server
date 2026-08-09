import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dy9ufrnrh",
  api_key: process.env.CLOUDINARY_API_KEY || "679799382995493",
  api_secret: process.env.CLOUDINARY_API_SECRET || "s4y0Cyizf2d792NLSsxWAJBwzys",
});

/**
 * Uploads a local file to Cloudinary and deletes it locally.
 * @param {string} localFilePath - Path to the local file
 * @param {string} resourceType - "image", "video", or "auto"
 * @returns {Promise<object>} Cloudinary upload response
 */
export const uploadToCloudinary = async (localFilePath, resourceType = "auto") => {
  try {
    if (!localFilePath) return null;

    const response = await cloudinary.uploader.upload(localFilePath, {
      folder: process.env.CLOUDINARY_FOLDER || "codestreak/posts",
      resource_type: resourceType,
    });

    // Delete local file after successful upload
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return response;
  } catch (error) {
    // Delete local file even if upload fails to avoid cluttering disk
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    console.error("Cloudinary upload error:", error);
    throw error;
  }
};

/**
 * Deletes a file from Cloudinary based on its URL or public ID.
 * @param {string} fileUrlOrId - Cloudinary URL or public ID
 * @param {string} resourceType - "image", "video", or "auto"
 * @returns {Promise<object>} Cloudinary deletion response
 */
export const deleteFromCloudinary = async (fileUrlOrId, resourceType = "auto") => {
  try {
    if (!fileUrlOrId) return null;

    let publicId = fileUrlOrId;

    // Check if the input is a URL and extract the public ID
    if (fileUrlOrId.startsWith("http")) {
      const parts = fileUrlOrId.split('/');
      const uploadIndex = parts.indexOf('upload');
      if (uploadIndex !== -1) {
        let startIndex = uploadIndex + 1;
        // Check if version folder exists (starts with 'v' and rest is numeric)
        if (parts[startIndex].startsWith('v') && !isNaN(parts[startIndex].substring(1))) {
          startIndex = uploadIndex + 2;
        } else {
          startIndex = uploadIndex + 1;
        }
        const publicIdWithExt = parts.slice(startIndex).join('/');
        const lastDot = publicIdWithExt.lastIndexOf('.');
        publicId = lastDot !== -1 ? publicIdWithExt.substring(0, lastDot) : publicIdWithExt;
      }
    }

    const response = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    return response;
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw error;
  }
};
