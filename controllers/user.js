module.exports.updateProfile = async (req, res) => {
  try {
    const targetId = req.params.id;
    const currentUserId = req.user.id || req.user._id;

    // 1. Authorization check
    if (currentUserId.toString() !== targetId && !req.user.isAdmin) {
      return res.status(403).send({ message: 'You are not allowed to update this profile' });
    }

    // 2. Find target user
    const user = await User.findById(targetId);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    const { username, email, currentPassword, newPassword } = req.body;
    const updates = {};

    // 3. Username Update & Duplication Check
    if (username && username !== user.username) {
      const existingUsername = await User.findOne({ username, _id: { $ne: targetId } });
      if (existingUsername) {
        return res.status(409).send({ message: 'Username already taken' });
      }
      updates.username = username;
    }

    // 4. Email Update & Duplication Check
    if (email && email !== user.email) {
      if (!email.includes('@')) {
        return res.status(400).send({ message: 'Invalid email format' });
      }
      const existingEmail = await User.findOne({ email, _id: { $ne: targetId } });
      if (existingEmail) {
        return res.status(409).send({ message: 'Email already registered' });
      }
      updates.email = email;
    }

    // 5. Image/Avatar Update via Cloudinary (Matches uploadProfilePicture schema)
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, 'blog/users');
      updates.image = {
        url: result.secure_url,
        publicId: result.public_id
      };
    }

    // 6. Password Update Validation & Hashing
    if (newPassword) {
      if (newPassword.length < 8) {
        return res.status(400).send({ message: 'New password must be at least 8 characters long' });
      }
      if (!currentPassword) {
        return res.status(400).send({ message: 'Current password is required to update password' });
      }

      const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordMatch) {
        return res.status(401).send({ message: 'Current password is incorrect' });
      }

      updates.password = await bcrypt.hash(newPassword, 10);
    }

    // 7. Prevent Empty Update Requests
    if (Object.keys(updates).length === 0) {
      return res.status(400).send({ message: 'No valid fields to update' });
    }

    // 8. Save Updates
    const updatedUser = await User.findByIdAndUpdate(targetId, updates, { 
      new: true, 
      runValidators: true 
    }).select('-password');

    return res.status(200).send({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (err) {
    return errorHandler(err, req, res);
  }
};