const express = require("express");
const router = express.Router();

const { enquiry } = require("../../controllers/enquiry-controller/equiryController");
const { authMiddleWare, isAdmin } = require("../../middleware/authMiddleware");

// Anyone can submit an enquiry, but only admins may read/update/delete them:
// enquiries contain name, email and phone number.
router.post("/", enquiry.create);
router.get("/", authMiddleWare, isAdmin, enquiry.getAll);
router.put("/:id", authMiddleWare, isAdmin, enquiry.update);
router.delete("/:id", authMiddleWare, isAdmin, enquiry.remove);
router.get("/:id", authMiddleWare, isAdmin, enquiry.getById);

module.exports = router;
