const express = require("express");
const router = express.Router();

const { color } = require("../../controllers/color-controller/colorController");
const { authMiddleWare, isAdmin } = require("../../middleware/authMiddleware");

router.post("/", authMiddleWare, isAdmin, color.create);
router.get("/", color.getAll);
router.put("/:id", authMiddleWare, isAdmin, color.update);
router.delete("/:id", authMiddleWare, isAdmin, color.remove);
router.get("/:id", color.getById);

module.exports = router;
