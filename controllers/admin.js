import TryCatch from "../middlewares/TryCatch.js";
import { Courses } from "../models/Courses.js";
import { Lecture } from "../models/Lecture.js";
import { rm } from "fs";
import { promisify } from "util";
import fs from "fs";
import { User } from "../models/User.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import { Payment } from "../models/Payment.js";

export const createCourse = TryCatch(async (req, res) => {
  const { title, description, category, createdBy, duration, price } = req.body;
  const image = req.file;

  if (!title || !description || !category || !createdBy || !duration || !price) {
    if (image && fs.existsSync(image.path)) {
      fs.unlinkSync(image.path);
    }
    return res.status(400).json({ message: "Please fill all required fields" });
  }

  if (!image) {
    return res.status(400).json({ message: "Course thumbnail image is required" });
  }

  const allowedImageMimetypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (!allowedImageMimetypes.includes(image.mimetype)) {
    if (fs.existsSync(image.path)) {
      fs.unlinkSync(image.path);
    }
    return res.status(400).json({ message: "Only image files (JPG, PNG, WEBP) are allowed" });
  }

  const uploadResult = await uploadToCloudinary(image.path, "image");
  const imageUrl = uploadResult?.secure_url || "";

  await Courses.create({
    title,
    description,
    category,
    createdBy,
    image: imageUrl,
    duration,
    price,
  });
  res.status(201).json({ message: "Course created successfully" });
});

export const addLectures = TryCatch(async (req, res) => {
  const course = await Courses.findById(req.params.id);
  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }
  const { title, description } = req.body;
  const file = req.file;

  if (!title || !description) {
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    return res.status(400).json({ message: "Please fill all required fields" });
  }

  if (!file) {
    return res.status(400).json({ message: "Lecture video is required" });
  }

  const allowedVideoMimetypes = ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-matroska"];
  if (!allowedVideoMimetypes.includes(file.mimetype)) {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    return res.status(400).json({ message: "Only video files (MP4, WEBM, MKV) are allowed" });
  }

  const uploadResult = await uploadToCloudinary(file.path, "video");
  const videoUrl = uploadResult?.secure_url || "";

  const lecture = await Lecture.create({
    title,
    description,
    video: videoUrl,
    course: course._id,
  });
  res.status(201).json({ message: "Lecture added successfully", lecture });
});

export const deleteLecture = TryCatch(async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  
  if (lecture.video) {
    if (lecture.video.startsWith("http")) {
      await deleteFromCloudinary(lecture.video, "video");
    } else {
      rm(lecture.video, () => {
        console.log("local video deleted");
      });
    }
  }

  await lecture.deleteOne();
  res.json({ message: "Lecture deleted successfully" });
});

const unlinkAsync = promisify(fs.unlink);

export const deleteCourse = TryCatch(async (req, res) => {
  const course = await Courses.findById(req.params.id);
  const lectures = await Lecture.find({ course: course._id });

  await Promise.all(
    lectures.map(async (lecture) => {
      if (lecture.video) {
        if (lecture.video.startsWith("http")) {
          await deleteFromCloudinary(lecture.video, "video");
        } else {
          try {
            await unlinkAsync(lecture.video);
            console.log("local video deleted");
          } catch (err) {
            console.error("Error deleting local video:", err);
          }
        }
      }
    })
  );

  if (course.image) {
    if (course.image.startsWith("http")) {
      await deleteFromCloudinary(course.image, "image");
    } else {
      rm(course.image, () => {
        console.log("local image deleted");
      });
    }
  }

  await Lecture.find({ course: course._id }).deleteMany();
  await course.deleteOne();
  await User.updateMany({}, { $pull: { subscription: req.params.id } });
  res.json({ message: "Course deleted successfully" });
});

export const getAllSats = TryCatch(async (req, res) => {
  const totalCourses = (await Courses.find()).length;
  const totalLectures = (await Lecture.find()).length;
  const totalUsers = (await User.find()).length;
  const totalPayments = (await Payment.find()).length;
  const stats = {
    totalCourses,
    totalLectures,
    totalUsers,
    totalPayments,
  };
  res.json({ stats });
});

export const getAllUser = TryCatch(async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } }).select(
    "-password"
  );

  res.json({ users });
});

export const updateRole = TryCatch(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user.role === "user") {
    user.role = "admin";
    await user.save();

    return res.status(200).json({
      message: "Role updated to admin",
    });
  }

  if (user.role === "admin") {
    user.role = "user";
    await user.save();

    return res.status(200).json({
      message: "Role updated",
    });
  }
});
