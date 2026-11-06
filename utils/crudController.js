const asyncHandler = require("express-async-handler");

const ApiError = require("./apiError");
const { assertObjectId, pick } = require("./helpers");

/**
 * Shared CRUD implementation for the simple lookup collections (category,
 * brand, blog category, color, coupon, enquiry). Every handler now:
 *  - validates the ObjectId,
 *  - whitelists writable fields (no mass assignment),
 *  - runs schema validators on update,
 *  - returns 404 instead of `null` with a 200,
 *  - lets the global error handler map duplicate keys to 409.
 */
const createCrudController = (Model, options = {}) => {
  const { label = "Resource", fields = [], select = "-__v" } = options;

  const create = asyncHandler(async (req, res) => {
    const doc = await Model.create(pick(req.body, fields));
    res.status(201).json(doc);
  });

  const getAll = asyncHandler(async (req, res) => {
    const docs = await Model.find().select(select).sort("-createdAt");
    res.status(200).json(docs);
  });

  const getById = asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, `${label} id`);
    const doc = await Model.findById(id).select(select);
    if (!doc) throw ApiError.notFound(`${label} not found`);
    res.status(200).json(doc);
  });

  const update = asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, `${label} id`);
    const payload = pick(req.body, fields);
    if (Object.keys(payload).length === 0) {
      throw ApiError.badRequest("No updatable fields supplied");
    }
    const doc = await Model.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
    if (!doc) throw ApiError.notFound(`${label} not found`);
    res.status(200).json(doc);
  });

  const remove = asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, `${label} id`);
    const doc = await Model.findByIdAndDelete(id);
    if (!doc) throw ApiError.notFound(`${label} not found`);
    res.status(200).json(doc);
  });

  return { create, getAll, getById, update, remove };
};

module.exports = createCrudController;
