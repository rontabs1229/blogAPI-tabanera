const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

const uploadToCloudinary = (fileBuffer, folder) => {
	return new Promise((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(
			{ folder: folder },
			(error, result) => {
				if (result) resolve(result);
				else reject(error);
			}
		);

		const readStream = streamifier.createReadStream(fileBuffer);
		readStream.on("error", reject);
		readStream.pipe(stream);
	});
};

/**
 * Extracts the Cloudinary public ID from a secure URL and deletes it.
 * Handles both raw public IDs and full Cloudinary URLs.
 */
const deleteFromCloudinary = async (imageUrlOrPublicId) => {
	if (!imageUrlOrPublicId) return;
	try {
		let publicId = imageUrlOrPublicId;

		// Check if it's a full Cloudinary URL
		if (imageUrlOrPublicId.includes("res.cloudinary.com")) {
			const parts = imageUrlOrPublicId.split("/");
			const uploadIndex = parts.indexOf("upload");
			
			if (uploadIndex !== -1) {
				// Skip 'upload' and optional version string (e.g., 'v12345678')
				let startIndex = uploadIndex + 1;
				if (parts[startIndex] && parts[startIndex].startsWith("v")) {
					startIndex++;
				}
				
				// Join the remaining parts and strip the file extension
				const pathWithExtension = parts.slice(startIndex).join("/");
				publicId = pathWithExtension.substring(0, pathWithExtension.lastIndexOf("."));
			}
		}

		return await cloudinary.uploader.destroy(publicId);
	} catch (error) {
		console.error("Cloudinary deletion error:", error);
	}
};

module.exports = {
	uploadToCloudinary,
	deleteFromCloudinary
};