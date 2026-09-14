import Joi from "joi";
import MenuItem from "../models/MenuItem.js";
import ApiError from "../utils/apiError.js";

const createMenuItemSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "Name is required",
  }),
  category: Joi.string()
    .valid("Snacks", "Drinks", "Meals", "Desserts")
    .required()
    .messages({
      "any.only": "Category must be one of Snacks, Drinks, Meals, Desserts",
      "any.required": "Category is required",
    }),
  price: Joi.number().min(1).required().messages({
    "number.min": "Price must be at least 1",
    "any.required": "Price is required",
  }),
  description: Joi.string().allow("").default(""),
  imageUrl: Joi.string().allow("").default(""),
  isAvailable: Joi.boolean().default(true),
});

const updateMenuItemSchema = Joi.object({
  name: Joi.string().trim(),
  category: Joi.string().valid("Snacks", "Drinks", "Meals", "Desserts"),
  price: Joi.number().min(1),
  description: Joi.string().allow(""),
  imageUrl: Joi.string().allow(""),
  isAvailable: Joi.boolean(),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

const toggleAvailabilitySchema = Joi.object({
  isAvailable: Joi.boolean().required().messages({
    "any.required": "isAvailable is required",
  }),
});

export const listMenuItems = async (req, res, next) => {
  const { category, search, available } = req.query;
  const filter = {};

  if (category) filter.category = category;
  if (search) filter.name = { $regex: search, $options: "i" };
  if (available !== undefined) filter.isAvailable = available === "true";

  const items = await MenuItem.find(filter).sort({ createdAt: -1 });
  res.status(200).json({ success: true, message: "Menu items fetched", data: { items } });
};

export const getMenuItem = async (req, res, next) => {
  const item = await MenuItem.findById(req.params.id);
  if (!item) throw new ApiError(404, "Menu item not found");
  res.status(200).json({ success: true, message: "Menu item fetched", data: { item } });
};

export const createMenuItem = async (req, res, next) => {
  const { error, value } = createMenuItemSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    const fields = {};
    error.details.forEach((d) => {
      fields[d.path.join(".")] = d.message;
    });
    throw new ApiError(422, "Validation failed", fields);
  }

  const item = await MenuItem.create(value);
  res.status(201).json({ success: true, message: "Menu item created", data: { item } });
};

export const updateMenuItem = async (req, res, next) => {
  const { error, value } = updateMenuItemSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    const fields = {};
    error.details.forEach((d) => {
      fields[d.path.join(".")] = d.message;
    });
    throw new ApiError(422, "Validation failed", fields);
  }

  const item = await MenuItem.findByIdAndUpdate(req.params.id, value, {
    new: true,
    runValidators: true,
  });

  if (!item) throw new ApiError(404, "Menu item not found");
  res.status(200).json({ success: true, message: "Menu item updated", data: { item } });
};

export const deleteMenuItem = async (req, res, next) => {
  const item = await MenuItem.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, "Menu item not found");
  res.status(200).json({ success: true, message: "Item deleted", data: {} });
};

export const toggleAvailability = async (req, res, next) => {
  const { error, value } = toggleAvailabilitySchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    const fields = {};
    error.details.forEach((d) => {
      fields[d.path.join(".")] = d.message;
    });
    throw new ApiError(422, "Validation failed", fields);
  }

  const item = await MenuItem.findByIdAndUpdate(
    req.params.id,
    { isAvailable: value.isAvailable },
    { new: true, runValidators: true }
  );

  if (!item) throw new ApiError(404, "Menu item not found");
  res.status(200).json({ success: true, message: "Availability updated", data: { item } });
};
