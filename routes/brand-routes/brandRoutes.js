const express = require('express');
const router = express.Router();

const { brand } = require('../../controllers/brand-controller/brandController');
const { isAdmin, authMiddleWare  } = require('../../middleware/authMiddleware');

router.post('/create', isAdmin, authMiddleWare, brand.createBrand);

router.get('/all', brand.getAllBrand);
router.get('/:id', brand.getBrand);

router.delete('/:id', isAdmin, authMiddleWare, brand.deleteBrand);

router.put('/:id', isAdmin, authMiddleWare, brand.updateBrand);

module.exports = router;