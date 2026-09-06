import { Router } from "express";
import authRoutes from "./auth.routes.js";
import menuRoutes from "./menu.routes.js";
import orderRoutes from "./order.routes.js";
import pickupSlotRoutes from "./pickupSlot.routes.js";
import adminRoutes from "./admin.routes.js";

const router = Router();

// Public routes
router.use(authRoutes);
router.use(menuRoutes);
router.use(pickupSlotRoutes);

// Customer protected routes
router.use(orderRoutes);

// Admin protected routes
router.use("/admin", adminRoutes);

export default router;