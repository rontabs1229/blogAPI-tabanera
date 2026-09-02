const express = require("express");
const router = express.Router();
const blogController = require("../controllers/blog");
const { userVerification, adminVerification } = require("../auth");
const upload = require("../middleware/upload");

router.post('/postBlog', userVerification, upload.array('images', 5), blogController.createBlog);
router.get('/getBlogs', blogController.getAllBlogs);
router.get('/getBlog/:blogId', blogController.getSpecificBlog);
router.patch("/updateBlog/:blogId", userVerification, upload.array('images', 5), blogController.editBlog);
router.delete("/deleteBlog/:blogId", userVerification, blogController.deleteBlog);

router.patch("/addComment/:blogId", userVerification, blogController.addComment);
router.get("/getComments/:blogId", blogController.getComments);
router.patch("/updateComment/:blogId/:commentId", userVerification, blogController.updateComment);
router.delete("/deleteComment/:blogId/:commentId", userVerification, blogController.deleteComment);

router.patch("/likeBlog/:blogId", userVerification, blogController.likeBlog);
router.patch("/unlikeBlog/:blogId", userVerification, blogController.unlikeBlog);

module.exports = router;