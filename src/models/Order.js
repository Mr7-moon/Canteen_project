import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },
    name: { type: String },
    price: { type: Number },
    quantity: { type: Number, required: true, min: 1, max: 10 },
  },
  { _id: false }
);

const ALLOWED_TRANSITIONS = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Preparing"],
  Preparing: ["Ready for Pickup"],
  "Ready for Pickup": ["Completed"],
  Completed: [],
  Cancelled: [],
};

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  items: [orderItemSchema],
  totalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: [
      "Pending",
      "Confirmed",
      "Preparing",
      "Ready for Pickup",
      "Completed",
      "Cancelled",
    ],
    default: "Pending",
  },
  pickupSlot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PickupSlot",
    required: true,
  },
  pickupTime: { type: String },
  placedAt: { type: Date, default: Date.now },
});

orderSchema.pre("save", async function () {
  if (this.isNew && !this.orderId) {
    let unique = false;
    while (!unique) {
      const num = Math.floor(1000 + Math.random() * 9000);
      const candidate = `ORD-${num}`;
      const existing = await mongoose.model("Order").findOne({
        orderId: candidate,
      });
      if (!existing) {
        this.orderId = candidate;
        unique = true;
      }
    }
  }
});

export { ALLOWED_TRANSITIONS };
export default mongoose.model("Order", orderSchema);