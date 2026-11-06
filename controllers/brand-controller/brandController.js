const createCrudController = require("../../utils/crudController");
const Brand = require("../../models/brand-model/brandModel");

const brand = createCrudController(Brand, {
  label: "Brand",
  fields: ["title"],
});

brand.createBrand = brand.create;
brand.getAllBrand = brand.getAll;
brand.getBrand = brand.getById;
brand.updateBrand = brand.update;
brand.deleteBrand = brand.remove;

module.exports = { brand };
