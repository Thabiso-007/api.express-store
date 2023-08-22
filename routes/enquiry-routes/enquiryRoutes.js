const express = require("express");
const router = express.Router();

const { enquiry } = require("../../controllers/enquiry-controller/equiryController");
const { authMiddleWare, isAdmin } = require("../../middleware/authMiddleware");

router.post("/", enquiry.createEnquiry);

router.put("/:id", authMiddleWare, isAdmin, enquiry.updateEnquiry);

router.delete("/:id", authMiddleWare, isAdmin, enquiry.deleteEnquiry);

router.get("/:id", enquiry.getEnquiry);
router.get("/", enquiry.getallEnquiry);

module.exports = router;