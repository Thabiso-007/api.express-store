const express = require('express');
const router = express.Router();

const { blogcat } = require('../../controllers/blog-category-controller/blogCategoryController');
const { isAdmin, authMiddleWare  } = require('../../middleware/authMiddleware');

router.post('/create', isAdmin, authMiddleWare, blogcat.createCategory);

router.get('/all', blogcat.getAllCategories);
router.get('/:id', blogcat.getCategory);

router.delete('/:id', isAdmin, authMiddleWare, blogcat.deleteCategory);

router.put('/:id', isAdmin, authMiddleWare, blogcat.updateCategory);

module.exports = router;