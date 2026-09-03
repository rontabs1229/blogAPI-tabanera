const express = require("express");
const router = express.Router();
const multer = require("multer");
const userController = require("../controllers/user");
const { userVerification } = require('../auth');

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/register', userController.registerUser)
router.post("/login", userController.loginUser);
router.get('/details', userVerification, userController.getUserProfile);
router.get('/getAllUsers', userController.getAllUsersProfile);
router.get('/:id', userController.getUserById);
router.put('/profile/:id', userVerification, upload.single('image'), userController.updateProfile
);
router.patch('/profile/picture/:id', userVerification, upload.single('image'), userController.uploadProfilePicture);
router.post('/follow/:id', userVerification, userController.followUser);
router.post('/unfollow/:id', userVerification, userController.unfollowUser);
router.get('/notifications', userVerification, userController.getNotifications);
router.patch('/notifications/:id/read', userVerification, userController.markNotificationRead);
router.patch('/:id/promote', userVerification, userController.changeToAdmin);

router.get('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if(err) {
            console.log("Error while destroying session: ", err);
            res.status(500).json({ message: "Could not log out" });
        } else {
            req.logout(() => {
                console.log("You are logged out!");
                res.status(200).json({ message: "Logged out successfully" });
            });
        }
    });
});

module.exports = router;