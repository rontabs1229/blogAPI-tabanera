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