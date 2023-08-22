const express = require('express');
const router = express.Router();

const { category } = require('../../controllers/category-controller/categoryController');
const { isAdmin, authMiddleWare  } = require('../../middleware/authMiddleware');

router.post('/create', isAdmin, authMiddleWare, category.createCategory);

router.get('/all', category.getAllCategories);
router.get('/:id', category.getCategory);

router.delete('/:id', isAdmin, authMiddleWare, category.deleteCategory);

router.put('/:id', isAdmin, authMiddleWare, category.updateCategory);

module.exports = router;