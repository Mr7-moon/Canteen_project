import Joi from "joi";
import Order, { ALLOWED_TRANSITIONS } from "../models/Order.js";
import MenuItem from "../models/MenuItem.js";
import PickupSlot from "../models/PickupSlot.js";
import ApiError from "../utils/apiError.js";
import paginate from "../utils/paginate.js";

const placeOrderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        menuItemId: Joi.string().required().messages({
          "any.required": "menuItemId is required",
        }),
        quantity: Joi.number().integer().min(1).max(10).required().messages({
          "number.min": "Quantity must be at least 1",
          "number.max": "Quantity cannot exceed 10",
          "any.required": "Quantity is required",
        }),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one item is required",
      "any.required": "Items are required",
    }),
  pickupSlotId: Joi.string().required().messages({
    "any.required": "Pickup slot ID is required",
  }),
});

export const placeOrder = async (req, res, next) => {
  const { error, value } = placeOrderSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    const fields = {};
    error.details.forEach((d) => {
      fields[d.path.join(".")] = d.message;
    });
    throw new ApiError(422, "Validation failed", fields);
  }

  const { items, pickupSlotId } = value;

  // Find and validate pickup slot
  const slot = await PickupSlot.findById(pickupSlotId);
  if (!slot) throw new ApiError(400, "Pickup slot not found");
  if (!slot.available)
    throw new ApiError(400, "Pickup slot is full or unavailable");

  // Fetch menu items
  const menuItemIds = items.map((i) => i.menuItemId);
  const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } });
  if (menuItems.length !== menuItemIds.length)
    throw new ApiError(400, "One or more menu items not found");

  // Build order items with snapshots
  const orderItems = [];
  let totalAmount = 0;

  for (const item of items) {
    const menuItem = menuItems.find(
      (m) => m._id.toString() === item.menuItemId
    );
    if (!menuItem.isAvailable)
      throw new ApiError(400, `Menu item "${menuItem.name}" is not available`);

    orderItems.push({
      menuItem: menuItem._id,
      name: menuItem.name,
      price: menuItem.price,
      quantity: item.quantity,
    });
    totalAmount += menuItem.price * item.quantity;
  }

  // Atomically increment slot count (concurrency-safe)
  const updatedSlot = await PickupSlot.findOneAndUpdate(
    { _id: pickupSlotId, orderCount: { $lt: slot.maxCapacity } },
    { $inc: { orderCount: 1 } },
    { new: true }
  );
  if (!updatedSlot)
    throw new ApiError(400, "Pickup slot became full. Please try another slot.");

  // Create order
  const order = await Order.create({
    user: req.user.id,
    items: orderItems,
    totalAmount,
    pickupSlot: pickupSlotId,
    pickupTime: updatedSlot.time,
  });

  res.status(201).json({ success: true, message: "Order placed", data: { order } });
};

export const listMyOrders = async (req, res, next) => {
  const { status } = req.query;
  const filter = { user: req.user.id };

  if (status === "active") {
    filter.status = {
      $in: ["Pending", "Confirmed", "Preparing", "Ready for Pickup"],
    };
  } else if (status === "past") {
    filter.status = { $in: ["Completed", "Cancelled"] };
  }

  const orders = await Order.find(filter)
    .populate("pickupSlot", "time label date")
    .sort({ placedAt: -1 });

  res.status(200).json({ success: true, message: "Orders fetched", data: { orders } });
};

export const getOrderDetail = async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate(
    "pickupSlot",
    "time label date"
  );

  if (!order) throw new ApiError(404, "Order not found");
  if (order.user.toString() !== req.user.id)
    throw new ApiError(403, "You can only view your own orders");

  res.status(200).json({ success: true, message: "Order fetched", data: { order } });
};

export const listAllOrders = async (req, res, next) => {
  const { status, date, page: pageStr, perPage: perPageStr } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);
    filter.placedAt = { $gte: start, $lte: end };
  }

  const result = await paginate(Order, filter, {
    page: pageStr,
    perPage: perPageStr || "20",
    sort: { placedAt: -1 },
  });

  const populatedItems = await Order.populate(result.items, {
    path: "user pickupSlot",
    select: "name phone time label date",
  });

  res.status(200).json({
    success: true,
    message: "Orders fetched",
    data: {
      orders: populatedItems,
      pagination: result.pagination,
    },
  });
};

export const updateOrderStatus = async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  const { status: newStatus } = req.body;
  if (!newStatus)
    throw new ApiError(422, "Status is required", { status: "Required" });

  const allowed = ALLOWED_TRANSITIONS[order.status];
  if (!allowed || !allowed.includes(newStatus))
    throw new ApiError(400, "Invalid status transition");

  order.status = newStatus;
  await order.save();

  res.status(200).json({ success: true, message: "Order status updated", data: { order } });
};
