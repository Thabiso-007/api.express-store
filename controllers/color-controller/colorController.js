const asyncHandler = require("express-async-handler");

const Color = require("../../models/color-model/colorModel");

const color = {
  // Insert a color
  createColor: asyncHandler(
    async (req, res) => {
      try {
        const newColor = await Color.create(req.body);
        res.json(newColor);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    }
  ),
  
  // Update a color
  updateColor: asyncHandler(
    async (req, res) => {
      const { id } = req.params;
    
      try {
        const updatedColor = await Color.findByIdAndUpdate(id, req.body, {
          new: true,
        });
        res.json(updatedColor)
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    }
  ),
  
  // Delete a Color
  deleteColor: asyncHandler(
    async (req, res) => {
      const { id } = req.params
    
      try {
        const deletedColor = await Color.findByIdAndDelete(id);
        res.json(deletedColor);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    }
  ),
  
  // Get a color
  getColor: asyncHandler(
    async (req, res) => {
      const { id } = req.params;
    
      try {
        const getaColor = await Color.findById(id);
        res.json(getaColor);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    }
  ),

  // Get all colors
  getallColor:  asyncHandler(
    async (req, res) => {
      try {
        const getallColor = await Color.find();
        res.json(getallColor);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    }
  )
}

module.exports = { color }