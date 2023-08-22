const asyncHandler = require("express-async-handler");

const Enquiry = require("../../models/enquiry-model/enquiryModel");

const enquiry = {
  // Create an enquiry
  createEnquiry: asyncHandler(
    async (req, res) => {
      try {
        const newEnquiry = await Enquiry.create(req.body)
        res.json(newEnquiry);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    }
  ),
  
  // Update an enquiry
  updateEnquiry: asyncHandler(
    async (req, res) => {
      const { id } = req.params;
      try {
        const updatedEnquiry = await Enquiry.findByIdAndUpdate(id, req.body, {
          new: true,
        })
        res.json(updatedEnquiry);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    }
  ),
  
  // Delete an enquiry
  deleteEnquiry: asyncHandler(
    async (req, res) => {
      const { id } = req.params;
      try {
        const deletedEnquiry = await Enquiry.findByIdAndDelete(id);
        res.json(deletedEnquiry);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    }
  ),
  
  // Fetch an enquiry by id
  getEnquiry: asyncHandler(
    async (req, res) => {
      const { id } = req.params;
      try {
        const getaEnquiry = await Enquiry.findById(id);
        res.json(getaEnquiry);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    }
  ),
  
  // Fetch an enquiry
  getallEnquiry: asyncHandler(
    async (req, res) => {
      try {
        const getallEnquiry = await Enquiry.find();
        res.json(getallEnquiry);
     } catch (error) {
      res.status(500).json({ message: error.message });
      }
    }
  ),
}

module.exports = { enquiry }