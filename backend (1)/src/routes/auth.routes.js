import { Router } from "express";
import {
  customerRegister,
  customerLogin,
  adminLogin,
} from "../controllers/auth.controller.js";

const router = Router();

// Auth routes (public)
router.post("/auth/login", customerLogin);
router.post("/auth/register", customerRegister);
router.post("/auth/admin/login", adminLogin);

export default router;