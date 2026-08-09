import TryCatch from "../middlewares/TryCatch.js";
import { Lecture } from "../models/Lecture.js";
import { Courses } from "../models/Courses.js";
import { User } from "../models/User.js";
import { instance } from "../config/razorpay.js";
import crypto from "crypto";
import { Payment } from "../models/Payment.js";
import { Order } from "../models/Order.js";
export const getAllCourses = TryCatch(async (req, res) => {
  const courses = await Courses.find();
  res.json({
    courses,
  });
});
export const getSingleCourse = TryCatch(async (req, res) => {
  const course = await Courses.findById(req.params.id);
  res.json({
    course,
  });
});

export const fetchLectures = TryCatch(async (req, res) => {
  const lectures = await Lecture.find({ course: req.params.id });
  const user = await User.findById(req.user._id);

  if (user.role === "admin") {
    return res.json({ lectures });
  }

  if (!user.subscription.includes(req.params.id)) {
    return res.status(400).json({
      message: "You are not subscribed to this course",
    });
  }

  return res.json({ lectures });
});

export const fetchLecture = TryCatch(async (req, res) => {
  const lecture = await Lecture.findById(req.params.id);
  const user = await User.findById(req.user._id);

  if (user.role === "admin") {
    return res.json({
      lecture,
    });
  }

  if (!user.subscription.includes(lecture.course.toString())) {
    return res.status(403).json({
      message: "You are not subscribed to this course",
    });
  }

  return res.json({
    lecture,
  });
});

export const getMyCourses = TryCatch(async (req, res) => {
  const courses = await Courses.find({ _id: req.user.subscription });
  res.json({
    courses,
  });
});

export const checkout = TryCatch(async (req, res) => {
  const user = await User.findById(req.user._id);
  const course = await Courses.findById(req.params.id);
  if (!course) {
    return res.status(404).json({
      message: "Course not found",
    });
  }
  if (user.subscription.includes(course._id)) {
    return res.status(400).json({
      message: "You are already subscribed to this course",
    });
  }
  const options = {
    amount: Number(course.price * 100),
    currency: "INR",
  };
  const order = await instance.orders.create(options);

  // Securely persist order details to verify during signature check
  await Order.create({
    orderId: order.id,
    user: user._id,
    course: course._id,
    amount: course.price,
  });

  res.json({
    order,
    course,
    key: process.env.Razorpay_key,
  });
});

export const paymentVerification = TryCatch(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      message: "Payment credentials are required",
    });
  }

  const course = await Courses.findById(req.params.id);
  if (!course) {
    return res.status(404).json({
      message: "Course not found",
    });
  }

  // 1. Replay Attack & Idempotency Check
  const paymentExists = await Payment.findOne({
    $or: [
      { razorpay_payment_id },
      { razorpay_order_id },
    ],
  });
  if (paymentExists) {
    return res.status(400).json({
      message: "Payment already processed",
    });
  }

  // 2. Validate stored Order details in local database
  const storedOrder = await Order.findOne({ orderId: razorpay_order_id });
  if (!storedOrder) {
    return res.status(400).json({
      message: "Invalid or expired order record",
    });
  }

  if (storedOrder.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      message: "Order ownership mismatch",
    });
  }

  if (storedOrder.course.toString() !== course._id.toString()) {
    return res.status(400).json({
      message: "Order course mismatch",
    });
  }

  if (storedOrder.amount !== course.price) {
    return res.status(400).json({
      message: "Order amount mismatch",
    });
  }

  if (storedOrder.status === "verified") {
    return res.status(400).json({
      message: "Order has already been verified",
    });
  }

  // 3. Confirm Razorpay cryptographic signature validity
  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.Razorpay_Secret)
    .update(body.toString())
    .digest("hex");

  const isAuthentic = expectedSignature === razorpay_signature;

  if (isAuthentic) {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    await Payment.create({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      user: user._id,
      course: course._id,
    });

    // Mark order status verified
    storedOrder.status = "verified";
    await storedOrder.save();

    user.subscription.push(course._id);
    await user.save();

    res.status(200).json({
      message: "Course Purchased Successfully",
    });
  } else {
    return res.status(400).json({
      message: "Payment verification failed",
    });
  }
});

export const updateProgress = TryCatch(async (req, res) => {
  const user = await User.findById(req.user._id);
  const lectureId = req.params.id;

  const lecture = await Lecture.findById(lectureId);
  if (!lecture) {
    return res.status(404).json({
      message: "Lecture not found",
    });
  }

  const course = await Courses.findById(lecture.course);
  if (!course) {
    return res.status(404).json({
      message: "Course not found",
    });
  }

  // Enforce enrollment validation
  if (!user.subscription.includes(course._id)) {
    return res.status(403).json({
      message: "You are not enrolled in this course",
    });
  }
  
  if (!user.completedLectures) {
    user.completedLectures = [];
  }

  const completedStrings = user.completedLectures.map((id) => id.toString());

  if (completedStrings.includes(lectureId.toString())) {
    user.completedLectures = user.completedLectures.filter(
      (id) => id.toString() !== lectureId.toString()
    );
  } else {
    user.completedLectures.push(lectureId);
  }
  
  await user.save();
  res.json({ message: "Progress updated", completedLectures: user.completedLectures });
});
