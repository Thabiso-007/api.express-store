const express = require("express");
const router = express.Router();

const { color } = require("../../controllers/color-controller/colorController");
const { authMiddleWare, isAdmin } = require("../../middleware/authMiddleware");


router.post("/", authMiddleWare, isAdmin, color.createColor);

router.get("/:id", color.getColor);
router.get("/", color.getallColor);

router.put("/:id", authMiddleWare, isAdmin, color.updateColor);

router.delete("/:id", authMiddleWare, isAdmin, color.deleteColor);


module.exports = router;