const asyncHandler = require("express-async-handler");
const slugify = require("slugify");
const crypto = require("crypto");

const Product = require("../../models/product-model/productModel");
const User = require("../../models/user-model/userModel");
const { cloudinaryUploadImg } = require("../../utils/cloudinary");
const ApiError = require("../../utils/apiError");
const {
  assertObjectId,
  pick,
  requireFields,
  asId,
} = require("../../utils/helpers");
const { buildProductQuery } = require("../../utils/query");

const WRITABLE_FIELDS = [
  "title",
  "description",
  "price",
  "category",
  "brand",
  "quantity",
  "images",
  "color",
  "tags",
];

const makeSlug = (title) => slugify(String(title), { lower: true, strict: true });

/** Avoid E11000 when two products share a title. */
const uniqueSlug = async (title, excludeId) => {
  const base = makeSlug(title);
  const filter = { slug: base };
  if (excludeId) filter._id = { $ne: excludeId };
  const existing = await Product.findOne(filter).select("_id");
  return existing ? `${base}-${crypto.randomBytes(3).toString("hex")}` : base;
};

const product = {
  // Create a product
  createProduct: asyncHandler(async (req, res) => {
    requireFields(req.body, [
      "title",
      "description",
      "price",
      "category",
      "brand",
      "quantity",
    ]);
    const payload = pick(req.body, WRITABLE_FIELDS);
    payload.slug = await uniqueSlug(payload.title);
    const newProduct = await Product.create(payload);
    res.status(201).json(newProduct);
  }),

  // Get all products (filtering, sorting, projection, pagination)
  getAllProducts: asyncHandler(async (req, res) => {
    const { filter, sort, fields, skip, limit, page } = buildProductQuery(req.query);
    const total = await Product.countDocuments(filter);
    if (page > 1 && skip >= total) {
      throw ApiError.notFound("This page does not exist");
    }
    const products = await Product.find(filter)
      .sort(sort)
      .select(fields)
      .skip(skip)
      .limit(limit)
      .populate("color");

    res.set("X-Total-Count", String(total));
    res.set("X-Total-Pages", String(Math.max(1, Math.ceil(total / limit))));
    res.status(200).json(products);
  }),

  // Get a product
  getSingleProduct: asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, "product id");
    const found = await Product.findById(id).populate("color");
    if (!found) throw ApiError.notFound("Product not found");
    res.status(200).json(found);
  }),

  // Update product
  updateProduct: asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, "product id");
    const payload = pick(req.body, WRITABLE_FIELDS);
    if (Object.keys(payload).length === 0) {
      throw ApiError.badRequest("No updatable fields supplied");
    }
    if (payload.title) payload.slug = await uniqueSlug(payload.title, id);
    // `findOneAndUpdate(id, ...)` passed a string as the filter and never
    // updated anything. Use findByIdAndUpdate with validators enabled.
    const updated = await Product.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
    if (!updated) throw ApiError.notFound("Product not found");
    res.status(200).json(updated);
  }),

  // Delete product
  deleteProduct: asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, "product id");
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) throw ApiError.notFound("Product not found");
    res.status(200).json(deleted);
  }),

  // Toggle a product in the user's wishlist
  addToWishList: asyncHandler(async (req, res) => {
    requireFields(req.body, ["prodId"]);
    const prodId = assertObjectId(req.body.prodId, "product id");
    if (!(await Product.findById(prodId).select("_id"))) {
      throw ApiError.notFound("Product not found");
    }
    const userId = req.user._id;
    const user = await User.findById(userId).select("wishlist");
    if (!user) throw ApiError.notFound("User not found");

    const alreadyAdded = (user.wishlist || []).some(
      (id) => asId(id) === String(prodId)
    );
    const updated = await User.findByIdAndUpdate(
      userId,
      alreadyAdded
        ? { $pull: { wishlist: prodId } }
        : { $addToSet: { wishlist: prodId } },
      { new: true }
    );
    res.status(200).json(updated);
  }),

  // Rate a product (one rating per user)
  rating: asyncHandler(async (req, res) => {
    requireFields(req.body, ["star", "prodId"]);
    const star = Number(req.body.star);
    if (!Number.isInteger(star) || star < 1 || star > 5) {
      throw ApiError.badRequest("star must be an integer between 1 and 5");
    }
    const prodId = assertObjectId(req.body.prodId, "product id");
    const found = await Product.findById(prodId);
    if (!found) throw ApiError.notFound("Product not found");

    const userId = String(req.user._id);
    // Schema field is `postedby` (lowercase b); the old code read `postedBy`,
    // which made every rating crash with "Cannot read properties of undefined".
    const ratings = (found.ratings || [])
      .filter((rating) => asId(rating.postedby) !== userId)
      .map((rating) => ({
        star: rating.star,
        comment: rating.comment,
        postedby: rating.postedby,
      }));
    ratings.push({
      star,
      comment: req.body.comment || "",
      postedby: req.user._id,
    });

    const sum = ratings.reduce((acc, item) => acc + (Number(item.star) || 0), 0);
    const totalrating = Math.round((sum / ratings.length) * 10) / 10;
    const updated = await Product.findByIdAndUpdate(
      prodId,
      { ratings, totalrating },
      { new: true, runValidators: true }
    );
    res.status(200).json(updated);
  }),

  // Upload product images
  uploadImages: asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, "product id");
    const found = await Product.findById(id).select("_id");
    if (!found) throw ApiError.notFound("Product not found");

    const urls = [];
    for (const file of req.files || []) {
      urls.push(await cloudinaryUploadImg(file.buffer, { folder: "express-store/products" }));
    }
    if (urls.length === 0) throw ApiError.badRequest("No images were uploaded");

    // The old code used findById(id, {images: ...}) - that is a projection,
    // not an update, so uploaded URLs were never persisted.
    const updated = await Product.findByIdAndUpdate(
      id,
      { $push: { images: { $each: urls } } },
      { new: true, runValidators: true }
    );
    res.status(200).json(updated);
  }),
};

// Canonical aliases
Object.assign(product, {
  create: product.createProduct,
  getAll: product.getAllProducts,
  getById: product.getSingleProduct,
  update: product.updateProduct,
  remove: product.deleteProduct,
});

module.exports = { product };
