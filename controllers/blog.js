const Blog = require("../models/Blog");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { errorHandler } = require('../auth');
const { uploadToCloudinary, deleteFromCloudinary } = require("../utils/uploadToCloudinary");
const cloudinary = require("../config/cloudinary");

module.exports.createBlog = async (req, res) => {
	if (!req.user) {
		return res.status(401).send({
			message: "Please login to post a Blog."
		});
	}
	try {
		const { title, content, city, country } = req.body;
		const author = req.user.id || req.user._id;

		let newBlog = new Blog({
			title,
			content,
			location: {
				city,
				country
			},
			author,
			images: []
		});

		if (req.files && req.files.length > 0) {
			const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer, "blog/posts"));
			const results = await Promise.all(uploadPromises);

			results.forEach(result => {
				newBlog.images.push({
					url: result.secure_url,
					publicId: result.public_id
				});
			});
		}

		const blog = await newBlog.save();

		const authorUser = await User.findById(author);
		if (authorUser && authorUser.followers && authorUser.followers.length > 0) {
			const notifications = authorUser.followers.map(follower => ({
				recipient: follower.userId || follower.user || follower,
				sender: author,
				type: "post",
				message: `${req.user.username || 'Someone'} published a new blog post: "${blog.title}"`
			}));

			await Notification.insertMany(notifications);
		}
		
		// Populate author before returning so the frontend immediately gets username & image
		await blog.populate('author', 'username image');
		return res.status(201).send(blog);
	} catch (error) {
		console.error("CREATE BLOG ERROR TRACE:", error);
		return errorHandler(error, req, res);
	}
};

module.exports.getAllBlogs = async (req, res) => {
	try {
		const blogs = await Blog.find({})
			.populate('author', 'username image') // <-- FIX: Populate blog author username and image
			.populate({
				path: 'likes.userId',
				select: 'username'
			})
			.populate({
				path: 'comments.userId',
				select: 'username'
			});

		return res.status(200).send({ blogs });
	} catch (error) {
		return errorHandler(error, req, res);
	}
};

module.exports.getSpecificBlog = async (req, res) => {
	try {
		const { blogId } = req.params;
		const blog = await Blog.findById(blogId)
			.populate('author', 'username image') // <-- FIX: Populate blog author username and image
			.populate({
				path: 'likes.userId',
				select: 'username'
			})
			.populate({
				path: 'comments.userId',
				select: 'username'
			});

		if (!blog) {
			return res.status(404).send({ message: "Blog not found" });
		}

		return res.status(200).send(blog);
	} catch (error) {
		return errorHandler(error, req, res);
	}
};

module.exports.editBlog = async (req, res) => {
	if (!req.user) {
		return res.status(401).send({
			message: "Please login to edit a blog."
		});
	}
	try {
		const { blogId } = req.params;
		const { title, content, city, country } = req.body;
		const userId = req.user.id || req.user._id;

		const blog = await Blog.findById(blogId);

		if (!blog) {
			return res.status(404).send({ message: "Blog not found" });
		}

		if (blog.author.toString() !== userId.toString()) {
			return res.status(403).send({
				message: "You can only edit your own blog"
			});
		}

		if (title) blog.title = title;
		if (content) blog.content = content;
		if (city || country) {
			if (!blog.location) blog.location = {};
			if (city) blog.location.city = city;
			if (country) blog.location.country = country;
		}

		if (req.files && req.files.length > 0) {
			const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer, "blog/posts"));
			const results = await Promise.all(uploadPromises);

			if (blog.images.length + results.length > 5) {
				return res.status(400).send({
					message: "A blog post can have at most 5 images in total."
				});
			}

			results.forEach(result => {
				blog.images.push({
					url: result.secure_url,
					publicId: result.public_id
				});
			});
		}

		const updatedBlog = await blog.save();
		await updatedBlog.populate('author', 'username image');
		
		return res.status(200).send({
			message: "Blog updated successfully",
			updatedBlog
		});
	} catch (error) {
		console.error("EDIT BLOG ERROR TRACE:", error);
		return errorHandler(error, req, res);
	}
};

module.exports.deleteBlog = async (req, res) => {
	if (!req.user) {
		return res.status(401).send({
			message: "Please login to delete a blog."
		});
	}

	try {
		const { blogId } = req.params;
		const userId = req.user.id || req.user._id;

		const blog = await Blog.findById(blogId);

		if (!blog) {
			return res.status(404).send({
				message: "Blog not found"
			});
		}

		const isAuthor = blog.author.toString() === userId.toString();
		const isAdmin = req.user.isAdmin;

		if (!isAdmin && !isAuthor) {
			return res.status(403).send({
				message: "You are not allowed to delete this blog"
			});
		}

		if (blog.images && blog.images.length > 0) {
			const deletePromises = blog.images.map(image =>
				deleteFromCloudinary(image.publicId)
			);
			await Promise.all(deletePromises);
		}

		await blog.deleteOne();
		return res.status(200).send({
			message: "Blog deleted successfully"
		});
	} catch (error) {
		return errorHandler(error, req, res);
	}
};

module.exports.addComment = async (req, res) => {
	if (!req.user) {
		return res.status(401).send({ message: "Please login to add a comment." });
	}

	try {
		const { blogId } = req.params;
		const { comment } = req.body;
		const userId = req.user.id || req.user._id;

		if (!comment || !comment.trim()) {
			return res.status(400).send({ message: "Comment text is required" });
		}

		const blog = await Blog.findById(blogId);
		if (!blog) {
			return res.status(404).send({ message: "Blog not found" });
		}

		blog.comments.push({ userId, comment });
		await blog.save();
		
		// Repopulate fields so updated blog payload has proper data structures
		const updatedBlog = await Blog.findById(blogId)
			.populate('author', 'username image')
			.populate({ path: 'likes.userId', select: 'username' })
			.populate({ path: 'comments.userId', select: 'username image' });

		if (blog.author.toString() !== userId.toString()) {
			await Notification.create({
				recipient: blog.author,
				sender: userId,
				type: 'comment',
				message: `${req.user.username || 'Someone'} commented on your blog`
			});
		}

		return res.status(200).send({
			message: "Comment added successfully",
			updatedBlog
		});
	} catch (error) {
		return errorHandler(error, req, res);
	}
};

module.exports.getComments = (req, res) => {
	const { blogId } = req.params;
	Blog.findById(blogId)
		.populate({
			path: 'comments.userId',
			select: 'username image'
		})
		.then(blog => {
			if (!blog) {
				return res.status(404).send({ message: "Blog not found" });
			}
			res.status(200).send({ comments: blog.comments });
		})
		.catch(error => errorHandler(error, req, res));
};

module.exports.updateComment = async (req, res) => {
	if (!req.user) {
		return res.status(401).send({
			message: "Please login to update a comment."
		});
	}

	try {
		const { blogId, commentId } = req.params;
		const { comment } = req.body;
		const userId = req.user.id || req.user._id;

		if (!comment || !comment.trim()) {
			return res.status(400).send({ message: "Comment text is required" });
		}

		const blog = await Blog.findById(blogId);
		if (!blog) {
			return res.status(404).send({ message: "Blog not found" });
		}

		const targetComment = blog.comments.id(commentId);
		if (!targetComment) {
			return res.status(404).send({ message: "Comment not found" });
		}

		if (targetComment.userId.toString() !== userId.toString()) {
			return res.status(403).send({ message: "You can only edit your own comment" });
		}

		targetComment.comment = comment;
		await blog.save();

		const updatedBlog = await Blog.findById(blogId)
			.populate('author', 'username image')
			.populate({ path: 'likes.userId', select: 'username' })
			.populate({ path: 'comments.userId', select: 'username' });

		return res.status(200).send({
			message: "Comment updated successfully",
			updatedBlog
		});
	} catch (error) {
		return errorHandler(error, req, res);
	}
};

module.exports.deleteComment = async (req, res) => {
	if (!req.user) {
		return res.status(401).send({
			message: "Please login to delete a comment."
		});
	}

	try {
		const { blogId, commentId } = req.params;
		const userId = req.user.id || req.user._id;

		const blog = await Blog.findById(blogId);
		if (!blog) {
			return res.status(404).send({ message: "Blog not found" });
		}

		const targetComment = blog.comments.id(commentId);
		if (!targetComment) {
			return res.status(404).send({ message: "Comment not found" });
		}

		const isCommenter = targetComment.userId.toString() === userId.toString();
		const isBlogAuthor = blog.author.toString() === userId.toString();
		const isAdmin = req.user.isAdmin;

		if (!isCommenter && !isBlogAuthor && !isAdmin) {
			return res.status(403).send({
				message: "You are not authorized to delete this comment"
			});
		}

		blog.comments.pull(commentId);
		await blog.save();

		const updatedBlog = await Blog.findById(blogId)
			.populate('author', 'username image')
			.populate({ path: 'likes.userId', select: 'username' })
			.populate({ path: 'comments.userId', select: 'username' });

		return res.status(200).send({
			message: "Comment deleted successfully",
			updatedBlog
		});
	} catch (error) {
		return errorHandler(error, req, res);
	}
};

module.exports.likeBlog = async (req, res) => {
	if (!req.user) {
		return res.status(401).send({ message: "Please login to like a blog." });
	}

	try {
		const { blogId } = req.params;
		const userId = req.user.id || req.user._id;

		const blog = await Blog.findById(blogId);
		if (!blog) {
			return res.status(404).send({ message: "Blog not found" });
		}

		const alreadyLiked = blog.likes.some(
			like => like.userId.toString() === userId.toString()
		);

		if (alreadyLiked) {
			return res.status(409).send({ message: "You have already liked this blog" });
		}

		blog.likes.push({ userId });
		await blog.save();

		if (blog.author.toString() !== userId.toString()) {
			await Notification.create({
				recipient: blog.author,
				sender: userId,
				type: 'like',
				message: `${req.user.username || 'Someone'} liked your blog post`
			});
		}

		return res.status(200).send({
			message: "Blog liked successfully",
			likesCount: blog.likes.length,
			likes: blog.likes
		});
	} catch (error) {
		return errorHandler(error, req, res);
	}
};

module.exports.unlikeBlog = async (req, res) => {
	if (!req.user) {
		return res.status(401).send({
			message: "Please login to unlike a blog."
		});
	}

	try {
		const { blogId } = req.params;
		const userId = req.user.id || req.user._id;

		const blog = await Blog.findById(blogId);
		if (!blog) {
			return res.status(404).send({ message: "Blog not found" });
		}

		const hasLiked = blog.likes.some(
			like => like.userId.toString() === userId.toString()
		);

		if (!hasLiked) {
			return res.status(400).send({ message: "You haven't liked this blog yet" });
		}

		blog.likes = blog.likes.filter(
			like => like.userId.toString() !== userId.toString()
		);

		await blog.save();

		return res.status(200).send({
			message: "Blog unliked successfully",
			likesCount: blog.likes.length,
			likes: blog.likes
		});
	} catch (error) {
		return errorHandler(error, req, res);
	}
};