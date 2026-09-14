import mongoose from "mongoose";

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: {
    type: String,
    required: true,
    enum: ["Snacks", "Drinks", "Meals", "Desserts"],
  },
  price: { type: Number, required: true, min: 1 },
  description: { type: String, default: "" },
  imageUrl: { type: String, default: "" },
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const MenuItem = mongoose.model("MenuItem", menuItemSchema);

export default MenuItem;