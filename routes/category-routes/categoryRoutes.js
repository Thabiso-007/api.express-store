const express = require("express");
const router = express.Router();

const { category } = require("../../controllers/category-controller/categoryController");
const { isAdmin, authMiddleWare } = require("../../middleware/authMiddleware");

router.post("/create", authMiddleWare, isAdmin, category.create);
router.get("/", category.getAll);
router.get("/all", category.getAll);
router.put("/:id", authMiddleWare, isAdmin, category.update);
router.delete("/:id", authMiddleWare, isAdmin, category.remove);
router.get("/:id", category.getById);

module.exports = router;
