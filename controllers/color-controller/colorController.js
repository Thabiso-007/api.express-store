const createCrudController = require("../../utils/crudController");
const Color = require("../../models/color-model/colorModel");

const color = createCrudController(Color, {
  label: "Color",
  fields: ["title"],
});

color.createColor = color.create;
color.getallColor = color.getAll;
color.getColor = color.getById;
color.updateColor = color.update;
color.deleteColor = color.remove;

module.exports = { color };
