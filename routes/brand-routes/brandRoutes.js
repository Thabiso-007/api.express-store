const express = require("express");
const router = express.Router();

const { brand } = require("../../controllers/brand-controller/brandController");
const { isAdmin, authMiddleWare } = require("../../middleware/authMiddleware");

router.post("/create", authMiddleWare, isAdmin, brand.create);
router.get("/", brand.getAll);
router.get("/all", brand.getAll);
router.put("/:id", authMiddleWare, isAdmin, brand.update);
router.delete("/:id", authMiddleWare, isAdmin, brand.remove);
router.get("/:id", brand.getById);

module.exports = router;
