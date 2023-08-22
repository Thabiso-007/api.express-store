const express = require('express');
const router = express.Router();

const { blog } = require('../../controllers/blog-controller/blogController');
const { isAdmin, authMiddleWare  } = require('../../middleware/authMiddleware');
const { uploadPhoto, blogImgResize } = require('../../middleware/uploadsImages');

router.post('/create', authMiddleWare, isAdmin, blog.createBlog);
router.put('/likes', authMiddleWare, blog.likeBlog);
router.put('/dislikes', authMiddleWare, blog.dislikeBlog);
router.put('/uploads/:id', authMiddleWare, isAdmin, uploadPhoto.array('images', 2), blogImgResize, blog.uploadImages);

router.get('/:id', blog.getBlog);
router.get('/', blog.getAllBlogs);

router.delete('/:id', authMiddleWare, isAdmin, blog.deleteBlog);

router.put('/:id', authMiddleWare, isAdmin, blog.updateBlog);

module.exports = router; 