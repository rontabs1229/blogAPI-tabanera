const User = require('../models/User');
const Notification = require('../models/Notification');
const bcrypt = require('bcryptjs');
const auth = require("../auth");
const { errorHandler } = require('../auth');
const uploadToCloudinary = require('../utils/uploadToCloudinary');

module.exports.registerUser = async (req, res) => {
	const { username, email, password } = req.body;

	if (!username) {
		return res.status(400).send({ message: 'Username is required' });
	}
	if (!email || !email.includes("@")) {
		return res.status(400).send({ message: 'Invalid email format' });
	}
	if (!password || password.length < 8) {
		return res.status(400).send({ message: 'Password must be at least 8 characters long' });
	}

	try {
		const existingUser = await User.findOne({
			$or: [{ email }, { username }]
		});

		if (existingUser) {
			if (existingUser.email === email) {
				return res.status(409).send({ message: "Email already registered" });
			}
			if (existingUser.username === username) {
				return res.status(409).send({ message: "Username already taken" });
			}
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		const newUser = new User({
			email,
			username,
			password: hashedPassword
		});

		await newUser.save();
		return res.status(201).send({ message: "Registered Successfully" });
	} catch (error) {
		return errorHandler(error, req, res);
	}
};

module.exports.loginUser = async (req, res) => {
	const { username, password } = req.body;

	if (!username || !password) {
		return res.status(400).send({ message: 'Username and password are required' });
	}

	try {
		const user = await User.findOne({ username });
		if (!user) {
			return res.status(401).send({ message: 'Invalid username or password' });
		}

		const isPasswordValid = await bcrypt.compare(password, user.password);
		if (!isPasswordValid) {
			return res.status(401).send({ message: 'Invalid username or password' });
		}

		return res.status(200).send({
			access: auth.createAccessToken(user)
		});
	} catch (error) {
		return errorHandler(error, req, res);
	}
};

module.exports.getUserProfile = async (req, res) => {
	try {
		const userId = req.user.id || req.user._id;
		const user = await User.findById(userId).select('-password');

		if (!user) {
			return res.status(404).send({ message: 'User not found' });
		}

		return res.status(200).send({ user });
	} catch (err) {
		return errorHandler(err, req, res);
	}
};

module.exports.uploadProfilePicture = async (req, res) => {
	try {
		const targetId = req.params.id;
		const currentUserId = req.user.id || req.user._id;

		if (currentUserId.toString() !== targetId && !req.user.isAdmin) {
			return res.status(403).send({ message: 'You are not allowed to update this profile' });
		}

		if (!req.file) {
			return res.status(400).send({ message: 'No image file provided' });
		}

		const result = await uploadToCloudinary(req.file.buffer, 'blog/users');
		const user = await User.findByIdAndUpdate(
			targetId,
			{
				image: {
					url: result.secure_url,
					publicId: result.public_id
				}
			},
			{ new: true }
		).select('-password');

		if (!user) {
			return res.status(404).send({ message: 'User not found' });
		}

		return res.status(200).send({
			message: 'Profile picture updated',
			user
		});
	} catch (err) {
		return errorHandler(err, req, res);
	}
};

module.exports.updateProfile = async (req, res) => {
	try {
		const targetId = req.params.id;
		const currentUserId = req.user.id || req.user._id;

		if (currentUserId.toString() !== targetId && !req.user.isAdmin) {
			return res.status(403).send({ message: 'You are not allowed to update this profile' });
		}

		const updates = {};
		if (req.body.username) updates.username = req.body.username;
		if (req.body.email) {
			if (!req.body.email.includes("@")) {
				return res.status(400).send({ message: 'Invalid email format' });
			}
			updates.email = req.body.email;
		}

		if (Object.keys(updates).length === 0) {
			return res.status(400).send({ message: 'No valid fields to update' });
		}

		const existingUser = await User.findOne({
			$or: [
				...(updates.email ? [{ email: updates.email }] : []),
				...(updates.username ? [{ username: updates.username }] : [])
			],
			_id: { $ne: targetId }
		});

		if (existingUser) {
			if (existingUser.email === updates.email) {
				return res.status(409).send({ message: "Email already registered" });
			}
			if (existingUser.username === updates.username) {
				return res.status(409).send({ message: "Username already taken" });
			}
		}

		const user = await User.findByIdAndUpdate(targetId, updates, { new: true }).select('-password');
		if (!user) {
			return res.status(404).send({ message: 'User not found' });
		}

		return res.status(200).send({
			message: 'Profile updated successfully',
			user
		});
	} catch (err) {
		return errorHandler(err, req, res);
	}
};

module.exports.followUser = async (req, res) => {
	if (!req.user) {
		return res.status(401).send({ message: 'Please login to follow a user.' });
	}

	try {
		const targetId = req.params.id;
		const currentUserId = req.user.id || req.user._id;

		if (targetId === currentUserId.toString()) {
			return res.status(400).send({ message: "You can't follow yourself" });
		}

		const targetUser = await User.findById(targetId);
		const currentUser = await User.findById(currentUserId);

		if (!targetUser || !currentUser) {
			return res.status(404).send({ message: 'User not found' });
		}

		const alreadyFollowing = targetUser.followers.some(
			follower => follower.userId.toString() === currentUserId.toString()
		);

		if (alreadyFollowing) {
			return res.status(409).send({ message: 'You are already following this user' });
		}

		targetUser.followers.push({ userId: currentUserId });
		currentUser.following.push({ userId: targetId });


		const isMutual = currentUser.followers.some(
			follower => follower.userId.toString() === targetId.toString()
		);

		let isTravelBuddyAdded = false;

		if (isMutual) {
			const alreadyBuddies = currentUser.travelBuddies.some(
				buddy => buddy.userId.toString() === targetId.toString()
			);

			if (!alreadyBuddies) {
				const now = new Date();
				currentUser.travelBuddies.push({ userId: targetId, since: now });
				targetUser.travelBuddies.push({ userId: currentUserId, since: now });
				isTravelBuddyAdded = true;
			}
		}

		await targetUser.save();
		await currentUser.save();

		const senderName = req.user.username || currentUser.username || 'Someone';

		if (isTravelBuddyAdded) {
			await Notification.create({
				recipient: targetId,
				sender: currentUserId,
				type: 'follow',
				message: `${senderName} followed you back! You are now Travel Buddies!`
			});
		} else {
			await Notification.create({
				recipient: targetId,
				sender: currentUserId,
				type: 'follow',
				message: `${senderName} started following you`
			});
		}

		return res.status(200).send({
			message: isTravelBuddyAdded 
				? 'User followed successfully. You are now Travel Buddies!' 
				: 'User followed successfully',
			followersCount: targetUser.followers.length,
			isTravelBuddy: isTravelBuddyAdded
		});
	} catch (err) {
		return errorHandler(err, req, res);
	}
};

module.exports.unfollowUser = async (req, res) => {
	if (!req.user) {
		return res.status(401).send({ message: 'Please login to unfollow a user.' });
	}

	try {
		const targetId = req.params.id;
		const currentUserId = req.user.id || req.user._id;

		const targetUser = await User.findById(targetId);
		const currentUser = await User.findById(currentUserId);

		if (!targetUser || !currentUser) {
			return res.status(404).send({ message: 'User not found' });
		}

		const isFollowing = targetUser.followers.some(
			follower => follower.userId.toString() === currentUserId.toString()
		);

		if (!isFollowing) {
			return res.status(409).send({ message: 'You are not following this user' });
		}


		targetUser.followers = targetUser.followers.filter(
			follower => follower.userId.toString() !== currentUserId.toString()
		);
		currentUser.following = currentUser.following.filter(
			f => f.userId.toString() !== targetId.toString()
		);


		currentUser.travelBuddies = currentUser.travelBuddies.filter(
			buddy => buddy.userId.toString() !== targetId.toString()
		);
		targetUser.travelBuddies = targetUser.travelBuddies.filter(
			buddy => buddy.userId.toString() !== currentUserId.toString()
		);

		await targetUser.save();
		await currentUser.save();

		return res.status(200).send({
			message: 'User unfollowed successfully',
			followersCount: targetUser.followers.length
		});
	} catch (err) {
		return errorHandler(err, req, res);
	}
};

module.exports.getNotifications = async (req, res) => {
	try {
		const currentUserId = req.user.id || req.user._id;
		const notifications = await Notification.find({ recipient: currentUserId })
			.populate('sender', 'username image')
			.sort({ createdAt: -1 });

		return res.status(200).send({ notifications });
	} catch (err) {
		return errorHandler(err, req, res);
	}
};

module.exports.markNotificationRead = async (req, res) => {
	try {
		const notificationId = req.params.id;
		const currentUserId = req.user.id || req.user._id;

		const notification = await Notification.findOneAndUpdate(
			{ _id: notificationId, recipient: currentUserId },
			{ read: true },
			{ new: true }
		);

		if (!notification) {
			return res.status(404).send({ message: 'Notification not found' });
		}

		return res.status(200).send({
			message: 'Notification marked as read',
			notification
		});
	} catch (err) {
		return errorHandler(err, req, res);
	}
};

module.exports.changeToAdmin = async (req, res) => {
	try {
		const targetId = req.params.id;
		const { adminSecretKey } = req.body;

		if (!adminSecretKey || adminSecretKey !== process.env.ADMIN_SECRET_KEY) {
			return res.status(403).send({ message: 'Invalid admin secret key' });
		}

		const user = await User.findByIdAndUpdate(
			targetId,
			{ isAdmin: true },
			{ new: true }
		).select('-password');

		if (!user) {
			return res.status(404).send({ message: 'User not found' });
		}

		return res.status(200).send({
			message: 'User promoted to admin successfully',
			user
		});
	} catch (err) {
		return errorHandler(err, req, res);
	}
};