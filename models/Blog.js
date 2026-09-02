const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true
	},
	comment: {
		type: String,
		required: [true, "Comment is required"]
	}
}, { timestamps: true });

const likeSchema = new mongoose.Schema({
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true
	},
	likedOn: {
		type: Date,
		default: Date.now
	}
});

const blogSchema = new mongoose.Schema({
	title: {
		type: String,
		required: [true, "Title is required"],
		trim: true
	},
	content: {
		type: String,
		required: [true, "Content is required"]
	},
	images: {
		type: [
			{
				url: { type: String, required: true },
				publicId: { type: String, required: true }
			}
		],
		default: [],
		validate: {
			validator: function (images) {
				return images.length <= 5;
			},
			message: "A blog post can have at most 5 images"
		}
	},
	location: {
		city: {
			type: String,
			required: [true, "Please enter a City"],
			trim: true
		},
		country: {
			type: String,
			required: [true, "Please enter a Country"],
			trim: true
		}
	},
	author: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true
	},
	likes: {
		type: [likeSchema],
		default: []
	},
	comments: {
		type: [commentSchema],
		default: []
	}
}, { timestamps: true });

module.exports = mongoose.model("Blog", blogSchema);