import { Router } from "express";
import {
  listMenuItems,
  getMenuItem,
} from "../controllers/menu.controller.js";

const router = Router();

// Public menu routes
router.get("/menu-items", listMenuItems);
router.get("/menu-items/:id", getMenuItem);

export default router;