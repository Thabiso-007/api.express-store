const express = require('express');
const router = express.Router();

const { product } = require('../../controllers/product-controller/productController');
const { isAdmin, authMiddleWare  } = require('../../middleware/authMiddleware');
const { uploadPhoto, productImgResize } = require('../../middleware/uploadsImages');

router.get('/', product.getAllProducts);
router.post('/create', authMiddleWare, isAdmin, product.createProduct);
router.put('/uploads/:id', authMiddleWare, isAdmin, uploadPhoto.array('images', 10), productImgResize, product.uploadImages);

router.put('/wishlist', authMiddleWare,  product.addToWishList);
router.put('/rating', authMiddleWare, product.rating);
router.put('/:id' ,authMiddleWare, isAdmin, product.updateProduct);

router.get('/:id', product.getSingleProduct); 

router.delete('/:id',authMiddleWare, isAdmin, product.deleteProduct);

module.exports = router;
