const multer = require("multer");

// Keep file in memory as a buffer so we can stream it straight to Cloudinary
const storage = multer.memoryStorage();

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const fileFilter = (req, file, cb) => {
	if (file.mimetype.startsWith("image/")) {
		cb(null, true);
	} else {
		cb(new Error("Only image files are allowed"), false);
	}
};

const upload = multer({
	storage,
	limits: { fileSize: MAX_FILE_SIZE },
	fileFilter
});

module.exports = upload;