import { Router } from "express";
import {
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
} from "../controllers/menu.controller.js";
import {
  listAllOrders,
  updateOrderStatus,
} from "../controllers/order.controller.js";
import { listAllSlotsAdmin } from "../controllers/pickupSlot.controller.js";
import {
  getSalesSummary,
  getOrderHistory,
} from "../controllers/report.controller.js";
import { verifyToken, requireAdmin } from "../middleware/auth.js";

const router = Router();

// All admin routes require authentication + admin role
router.use(verifyToken, requireAdmin);

// Admin menu management
router.get("/menu-items", listMenuItems);
router.post("/menu-items", createMenuItem);
router.put("/menu-items/:id", updateMenuItem);
router.delete("/menu-items/:id", deleteMenuItem);
router.patch("/menu-items/:id/availability", toggleAvailability);

// Admin order management
router.get("/orders", listAllOrders);
router.patch("/orders/:id/status", updateOrderStatus);

// Admin pickup slot management
router.get("/pickup-slots", listAllSlotsAdmin);

// Admin reports
router.get("/reports", getSalesSummary);
router.get("/reports/orders", getOrderHistory);

export default router;