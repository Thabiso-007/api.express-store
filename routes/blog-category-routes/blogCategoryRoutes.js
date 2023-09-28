const express = require('express');
const router = express.Router();

const { blogcat } = require('../../controllers/blog-category-controller/blogCategoryController');
const { isAdmin, authMiddleWare  } = require('../../middleware/authMiddleware');

router.post('/create', authMiddleWare, isAdmin, blogcat.createCategory);

router.get('/all', blogcat.getAllCategories);
router.get('/:id', blogcat.getCategory);

router.delete('/:id', authMiddleWare, isAdmin, blogcat.deleteCategory);

router.put('/:id', authMiddleWare, isAdmin, blogcat.updateCategory);

module.exports = router;
