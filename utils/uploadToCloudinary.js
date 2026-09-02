const cloudinary = require("../config/cloudinary");

const uploadToCloudinary = (buffer, folder = "blog") => {
	return new Promise((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(
			{ folder, resource_type: "image" },
			(error, result) => {
				if (error) return reject(error);
				resolve(result);
			}
		);
		stream.end(buffer);
	});
};

const deleteFromCloudinary = async (publicId) => {
	if (!publicId) return;
	try {
		return await cloudinary.uploader.destroy(publicId);
	} catch (error) {
		console.error("Cloudinary deletion error:", error);
	}
};

module.exports = {
	uploadToCloudinary,
	deleteFromCloudinary
};