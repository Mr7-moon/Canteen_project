import { Router } from "express";
import {
  placeOrder,
  listMyOrders,
  getOrderDetail,
} from "../controllers/order.controller.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

// All customer order routes require authentication
router.use(verifyToken);

router.post("/orders", placeOrder);
router.get("/orders", listMyOrders);
router.get("/orders/:id", getOrderDetail);

export default router;