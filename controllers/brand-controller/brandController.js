const asyncHandler = require('express-async-handler')

const Brand = require('../../models/brand-model/brandModel')

const brand = {
    // Create category
    createBrand: asyncHandler(
        async (req, res) => {
            try {
                const newCategory = await Brand.create(req.body);
                res.status(200).json(newCategory);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    ),

    // Update catergory
    updateBrand: asyncHandler(
        async (req, res) => {
            const { id } = req.params; 
            try {
                const updatedCategory = await Brand.findByIdAndUpdate(id, req.body, { new: true });
                res.status(200).json(updatedCategory);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    ),

    // Delete category
    deleteBrand: asyncHandler(
        async (req, res) => {
            const { id } = req.params; 
            try {
                const deletedCategory = await Brand.findByIdAndDelete(id);
                res.status(200).json(deletedCategory);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    ),

    // Fetch category
    getBrand: asyncHandler(
        async (req, res) => {
            const { id } = req.params;
            try {
                const fetchCategory = await Brand.findById(id);
                res.status(200).json(fetchCategory);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    ),

    // Fetch all category
    getAllBrand: asyncHandler(
        async (req, res) => {
            try {
                const fetchCategories = await Brand.find();
                res.status(200).json(fetchCategories);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }
    )
}

module.exports = { brand }