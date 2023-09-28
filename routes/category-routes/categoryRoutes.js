const express = require('express');
const router = express.Router();

const { category } = require('../../controllers/category-controller/categoryController');
const { isAdmin, authMiddleWare  } = require('../../middleware/authMiddleware');

router.post('/create', authMiddleWare, isAdmin, category.createCategory);

router.get('/all', category.getAllCategories);
router.get('/:id', category.getCategory);

router.delete('/:id', authMiddleWare, isAdmin, category.deleteCategory);

router.put('/:id', authMiddleWare, isAdmin, category.updateCategory);

module.exports = router;