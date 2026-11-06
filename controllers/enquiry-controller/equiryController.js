const createCrudController = require("../../utils/crudController");
const Enquiry = require("../../models/enquiry-model/enquiryModel");

const enquiry = createCrudController(Enquiry, {
  label: "Enquiry",
  fields: ["name", "email", "mobile", "comment", "status"],
});

enquiry.createEnquiry = enquiry.create;
enquiry.getallEnquiry = enquiry.getAll;
enquiry.getEnquiry = enquiry.getById;
enquiry.updateEnquiry = enquiry.update;
enquiry.deleteEnquiry = enquiry.remove;

module.exports = { enquiry };
