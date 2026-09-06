import mongoose from "mongoose";

const pickupSlotSchema = new mongoose.Schema(
  {
    time: { type: String, required: true }, // e.g. "10:00 AM"
    label: { type: String },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    maxCapacity: { type: Number, default: 10 },
    orderCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

pickupSlotSchema.virtual("available").get(function () {
  return this.orderCount < this.maxCapacity;
});

pickupSlotSchema.virtual("remaining").get(function () {
  return this.maxCapacity - this.orderCount;
});

const PickupSlot = mongoose.model("PickupSlot", pickupSlotSchema);

export default PickupSlot;