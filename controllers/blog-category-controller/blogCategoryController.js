const createCrudController = require("../../utils/crudController");
const BlogCategory = require("../../models/blog-catergory-model/blogCategoryModel");

const blogcat = createCrudController(BlogCategory, {
  label: "Blog category",
  fields: ["title"],
});

blogcat.createCategory = blogcat.create;
blogcat.getAllCategories = blogcat.getAll;
blogcat.getCategory = blogcat.getById;
blogcat.updateCategory = blogcat.update;
blogcat.deleteCategory = blogcat.remove;

module.exports = { blogcat };
