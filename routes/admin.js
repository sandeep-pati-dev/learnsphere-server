import express from "express";
import {
  addLectures,
  createCourse,
  deleteCourse,
  deleteLecture,
  getAllSats,
  getAllUser,
  updateRole,
} from "../controllers/admin.js";
import { isAdmin, isAuth } from "../middlewares/isAuth.js";
import { uploadImageMiddleware, uploadVideoMiddleware } from "../middlewares/multer.js";

const router = express.Router();

router.post("/course/new", isAuth, isAdmin, uploadImageMiddleware, createCourse);
router.post("/course/:id", isAuth, isAdmin, uploadVideoMiddleware, addLectures);
router.delete("/lecture/:id", isAuth, isAdmin, deleteLecture);
router.delete("/course/:id", isAuth, isAdmin, deleteCourse);
router.get("/stats", isAuth, isAdmin, getAllSats);
router.put("/user/:id", isAuth, isAdmin, updateRole);
router.get("/user", isAuth, isAdmin, getAllUser);

export default router;
