const express = require('express');
const router = express.Router();

const { brand } = require('../../controllers/brand-controller/brandController');
const { isAdmin, authMiddleWare  } = require('../../middleware/authMiddleware');

router.post('/create', authMiddleWare, isAdmin, brand.createBrand);

router.get('/all', brand.getAllBrand);
router.get('/:id', brand.getBrand);

router.delete('/:id', authMiddleWare, isAdmin, brand.deleteBrand);

router.put('/:id', authMiddleWare, isAdmin, brand.updateBrand);

module.exports = router;
