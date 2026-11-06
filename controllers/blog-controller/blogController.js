const asyncHandler = require("express-async-handler");

const Blog = require("../../models/blog-model/blogModel");
const { cloudinaryUploadImg } = require("../../utils/cloudinary");
const ApiError = require("../../utils/apiError");
const { assertObjectId, pick, requireFields, asId } = require("../../utils/helpers");

const WRITABLE_FIELDS = ["title", "description", "category", "images", "author"];

/** Toggle a user's like/dislike, keeping the legacy boolean flags in sync. */
const toggleReaction = async (req, res, reaction) => {
  requireFields(req.body, ["blogId"]);
  const blogId = assertObjectId(req.body.blogId, "blog id");
  const blog = await Blog.findById(blogId);
  if (!blog) throw ApiError.notFound("Blog not found");

  const userId = String(req.user._id);
  const likes = (blog.likes || []).map(asId);
  const dislikes = (blog.dislikes || []).map(asId);
  const target = reaction === "like" ? likes : dislikes;
  const opposite = reaction === "like" ? dislikes : likes;
  const alreadyReacted = target.includes(userId);

  const nextTarget = alreadyReacted
    ? target.filter((id) => id !== userId)
    : [...target, userId];
  const nextOpposite = opposite.filter((id) => id !== userId);

  const payload =
    reaction === "like"
      ? {
          likes: nextTarget,
          dislikes: nextOpposite,
          isLiked: nextTarget.length > 0,
          isDisliked: nextOpposite.length > 0,
        }
      : {
          likes: nextOpposite,
          dislikes: nextTarget,
          isLiked: nextOpposite.length > 0,
          isDisliked: nextTarget.length > 0,
        };

  const updated = await Blog.findByIdAndUpdate(blogId, payload, {
    new: true,
    runValidators: true,
  });
  res.status(200).json(updated);
};

const blog = {
  createBlog: asyncHandler(async (req, res) => {
    requireFields(req.body, ["title", "description", "category"]);
    const newBlog = await Blog.create(pick(req.body, WRITABLE_FIELDS));
    res.status(201).json({ status: "success", newBlog });
  }),

  updateBlog: asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, "blog id");
    const payload = pick(req.body, WRITABLE_FIELDS);
    if (Object.keys(payload).length === 0) {
      throw ApiError.badRequest("No updatable fields supplied");
    }
    const updated = await Blog.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
    if (!updated) throw ApiError.notFound("Blog not found");
    res.status(200).json(updated);
  }),

  getBlog: asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, "blog id");
    // Increment and return the *updated* document in a single atomic op.
    const updated = await Blog.findByIdAndUpdate(
      id,
      { $inc: { numViews: 1 } },
      { new: true, runValidators: true }
    )
      .populate("likes")
      .populate("dislikes");
    if (!updated) throw ApiError.notFound("Blog not found");
    res.status(200).json(updated);
  }),

  getAllBlogs: asyncHandler(async (req, res) => {
    const blogs = await Blog.find().sort("-createdAt");
    res.status(200).json(blogs);
  }),

  deleteBlog: asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, "blog id");
    const deleted = await Blog.findByIdAndDelete(id);
    if (!deleted) throw ApiError.notFound("Blog not found");
    res.status(200).json(deleted);
  }),

  likeBlog: asyncHandler((req, res) => toggleReaction(req, res, "like")),
  dislikeBlog: asyncHandler((req, res) => toggleReaction(req, res, "dislike")),

  uploadImages: asyncHandler(async (req, res) => {
    const id = assertObjectId(req.params.id, "blog id");
    const found = await Blog.findById(id).select("_id");
    if (!found) throw ApiError.notFound("Blog not found");

    const urls = [];
    for (const file of req.files || []) {
      urls.push(await cloudinaryUploadImg(file.buffer, { folder: "express-store/blogs" }));
    }
    if (urls.length === 0) throw ApiError.badRequest("No images were uploaded");

    const updated = await Blog.findByIdAndUpdate(
      id,
      { $push: { images: { $each: urls } } },
      { new: true, runValidators: true }
    );
    res.status(200).json(updated);
  }),
};

Object.assign(blog, {
  create: blog.createBlog,
  getAll: blog.getAllBlogs,
  getById: blog.getBlog,
  update: blog.updateBlog,
  remove: blog.deleteBlog,
});

module.exports = { blog };
