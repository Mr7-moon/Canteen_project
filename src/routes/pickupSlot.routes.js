import { Router } from "express";
import { listAvailableSlots } from "../controllers/pickupSlot.controller.js";

const router = Router();

// Public pickup slot routes
router.get("/pickup-slots", listAvailableSlots);

export default router;