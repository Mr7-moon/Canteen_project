import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: { type: String, required: true, minlength: 8 },
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;