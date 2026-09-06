import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./src/config/db.js";
import rootRouter from "./src/routes/routes.js";
import errorHandler from "./src/middleware/errorHandler.js";
import { generateDailySlots } from "./src/controllers/pickupSlot.controller.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB and generate slots
connectDB().then(() => {
  generateDailySlots();
});

// Routes
app.use(rootRouter);

// 404 handler for unknown routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    data: {},
  });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;