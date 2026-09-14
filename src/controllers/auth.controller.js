import Joi from "joi";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import generateToken from "../utils/generateToken.js";
import ApiError from "../utils/apiError.js";

const registerSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "Name is required",
  }),
  phone: Joi.string()
    .pattern(/^03[0-9]{9}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone must be a valid Pakistani mobile number (e.g. 03001234567)",
      "any.required": "Phone is required",
    }),
  password: Joi.string().min(8).required().messages({
    "string.min": "Password must be at least 8 characters",
    "any.required": "Password is required",
  }),
});

const loginSchema = Joi.object({
  phone: Joi.string().required().messages({
    "any.required": "Phone is required",
  }),
  password: Joi.string().required().messages({
    "any.required": "Password is required",
  }),
});

const adminLoginSchema = Joi.object({
  identifier: Joi.string().required().messages({
    "any.required": "Username or email is required",
  }),
  password: Joi.string().required().messages({
    "any.required": "Password is required",
  }),
});

export const customerRegister = async (req, res, next) => {
  const { error, value } = registerSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    const fields = {};
    error.details.forEach((d) => {
      fields[d.path.join(".")] = d.message;
    });
    throw new ApiError(422, "Validation failed", fields);
  }

  const { name, phone, password } = value;

  const existingUser = await User.findOne({ phone });
  if (existingUser) {
    throw new ApiError(409, "Phone number already registered", {
      phone: "Already registered",
    });
  }

  const user = await User.create({ name, phone, password });

  res.status(201).json({
    success: true,
    message: "Registered successfully",
    data: {
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
      },
    },
  });
};

export const customerLogin = async (req, res, next) => {
  const { error, value } = loginSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    const fields = {};
    error.details.forEach((d) => {
      fields[d.path.join(".")] = d.message;
    });
    throw new ApiError(422, "Validation failed", fields);
  }

  const { phone, password } = value;

  const user = await User.findOne({ phone });
  if (!user) {
    throw new ApiError(401, "Invalid phone or password");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, "Invalid phone or password");
  }

  const token = generateToken({ id: user._id, role: "customer" });

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
      },
    },
  });
};

export const adminLogin = async (req, res, next) => {
  const { error, value } = adminLoginSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    const fields = {};
    error.details.forEach((d) => {
      fields[d.path.join(".")] = d.message;
    });
    throw new ApiError(422, "Validation failed", fields);
  }

  const { identifier, password } = value;

  const admin = await Admin.findOne({
    $or: [{ username: identifier }, { email: identifier }],
  });

  if (!admin) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, "Invalid credentials");
  }

  const token = generateToken({ id: admin._id, role: "admin" });

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
      },
    },
  });
};
