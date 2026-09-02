const jwt = require("jsonwebtoken");
const multer = require("multer");
require('dotenv').config();

module.exports.createAccessToken = (user) => {
	const data = {
		id: user._id,
		email: user.email,
		username: user.username,
		isAdmin: user.isAdmin
	};

	return jwt.sign(data, process.env.JWT_KEY, {});
};

module.exports.userVerification = (req, res, next) => {
	let token = req.headers.authorization;

	if (typeof token === 'undefined') {
		return res.status(401).send({ auth: "Failed. No Token" });
	} else {
		token = token.slice(7);

		jwt.verify(token, process.env.JWT_KEY, (err, decodedToken) => {
			if (err) {
				return res.status(403).send({
					auth: "Failed",
					message: err.message
				});
			} else {
				req.user = decodedToken;
				next();
			}
		});
	}
};

module.exports.adminVerification = (req, res, next) => {
	if (req.user && req.user.isAdmin) {
		next();
	} else {
		return res.status(403).send({
			auth: "Failed",
			message: "Action Forbidden"
		});
	}
};

module.exports.errorHandler = (err, req, res, next) => {
	console.log("ERROR FOUND:");
	console.log(err);

	if (err instanceof multer.MulterError) {
		if (err.code === "LIMIT_FILE_SIZE") {
			return res.status(400).send({ message: "File size cannot exceed 5MB." });
		}
		return res.status(400).send({ message: err.message });
	}

	if (err.message === "Only image files are allowed") {
		return res.status(400).send({ message: err.message });
	}

	const statusCode = err.status || err.statusCode || 500;
	const errorMessage = err.message || 'Internal Server Error';

	return res.status(statusCode).json({
		error: {
			message: errorMessage,
			errorCode: err.code || 'SERVER_ERROR',
			details: err.details || null
		}
	});
};