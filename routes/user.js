import express from "express";
import {
  loginUser,
  myProfile,
  register,
  verifyUser,
  applyTutor,
} from "../controllers/user.js";
import { isAuth } from "../middlewares/isAuth.js";

const router = express.Router();

router.post("/user/register", register);
router.post("/user/verify", verifyUser);
router.post("/user/login", loginUser);
router.get("/user/me", isAuth, myProfile);
router.post("/user/apply-tutor", isAuth, applyTutor);

export default router;
