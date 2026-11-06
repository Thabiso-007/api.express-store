const createCrudController = require("../../utils/crudController");
const Category = require("../../models/category-model/categoryModel");

const category = createCrudController(Category, {
  label: "Category",
  fields: ["title"],
});

// Named aliases keep the original controller API working for any consumer
// that imported these methods by name.
category.createCategory = category.create;
category.getAllCategories = category.getAll;
category.getCategory = category.getById;
category.updateCategory = category.update;
category.deleteCategory = category.remove;

module.exports = { category };
