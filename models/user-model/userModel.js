const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: { validator: (v) => EMAIL_RE.test(v), message: "Invalid email address" },
    },
    mobile: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isBlocked: { type: Boolean, default: false },
    cart: { type: Array, default: [] },
    address: { type: String },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    refreshToken: { type: String },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        // Never serialise credentials, even when a controller returns the doc.
        delete ret.password;
        delete ret.refreshToken;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

userSchema.pre("save", async function (next) {
  // The original hook called next() but forgot to return, so EVERY save
  // (forgot-password, reset-password, ...) re-hashed the stored hash and
  // permanently locked the user out.
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    if (!this.isNew) this.passwordChangedAt = Date.now() - 1000;
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.isPasswordMatched = function (enteredPassword) {
  if (!this.password || typeof enteredPassword !== "string") {
    return Promise.resolve(false);
  }
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

module.exports = mongoose.model("User", userSchema);
