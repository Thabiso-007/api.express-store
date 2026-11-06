const express = require("express");
const router = express.Router();

const { blogcat } = require("../../controllers/blog-category-controller/blogCategoryController");
const { isAdmin, authMiddleWare } = require("../../middleware/authMiddleware");

router.post("/create", authMiddleWare, isAdmin, blogcat.create);
router.get("/", blogcat.getAll);
router.get("/all", blogcat.getAll);
router.put("/:id", authMiddleWare, isAdmin, blogcat.update);
router.delete("/:id", authMiddleWare, isAdmin, blogcat.remove);
router.get("/:id", blogcat.getById);

module.exports = router;
