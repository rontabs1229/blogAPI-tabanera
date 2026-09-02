const mongoose = require("mongoose");

const travelBuddiesSchema = new mongoose.Schema({
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true
	},
	since: {
		type: Date,
		default: Date.now
	}
}, { _id: false });

const userSchema = new mongoose.Schema({
	image: {
		url: { type: String, default: "" },
		publicId: { type: String, default: "" }
	},
	email: {
		type: String,
		required: [true, "Email is required"],
		unique: true,
		lowercase: true,
		trim: true
	},
	username: {
		type: String,
		required: [true, "Username is required"],
		unique: true,
		trim: true
	},
	password: {
		type: String,
		required: [true, "Password is required"]
	},
	followers: [{
		_id: false,
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true
		}
	}],
	following: [{
		_id: false,
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true
		}
	}],
	travelBuddies: {
		type: [travelBuddiesSchema],
		default: []
	},
	isAdmin: {
		type: Boolean,
		default: false
	}
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);