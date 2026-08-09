import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { checkout, paymentVerification, updateProgress } from "../controllers/course.js";
import { Courses } from "../models/Courses.js";
import { User } from "../models/User.js";
import { Lecture } from "../models/Lecture.js";
import { Order } from "../models/Order.js";
import { Payment } from "../models/Payment.js";

dotenv.config();

const runTests = async () => {
  console.log("🚀 Starting LearnSphere Security Verification Tests...");
  
  await mongoose.connect(process.env.DB);
  console.log("✅ Connected to MongoDB Atlas Database");

  // Create clean mock entities
  const testUser = await User.create({
    name: "Test Student",
    email: `student-${Date.now()}@example.com`,
    password: "hashedpassword123",
    role: "user",
    subscription: [],
  });

  const cheapCourse = await Courses.create({
    title: "Cheap Course A",
    description: "Introductory course A",
    category: "Web Development",
    createdBy: "Instructor",
    duration: 4,
    price: 100,
    image: "uploads/thumbnail-a.png",
  });

  const premiumCourse = await Courses.create({
    title: "Premium Course B",
    description: "Advanced masterclass B",
    category: "Web Development",
    createdBy: "Instructor",
    duration: 12,
    price: 5000,
    image: "uploads/thumbnail-b.png",
  });

  const lecture = await Lecture.create({
    title: "Premium Lecture 1",
    description: "Secret lecture content",
    video: "uploads/lecture-1.mp4",
    course: premiumCourse._id,
  });

  console.log("✅ Set up mock DB user, courses, and lecture records");

  try {
    // Test Case 1: Progress Authorization Check
    console.log("\n🧪 Running Test 1: Progress Authorization Guard...");
    let resStatus = 0;
    let resData = null;
    const mockRes = {
      status(code) {
        resStatus = code;
        return this;
      },
      json(data) {
        resData = data;
        return this;
      }
    };

    // User is not enrolled in premiumCourse, so updateProgress should return 403 Forbidden!
    await updateProgress({
      user: { _id: testUser._id },
      params: { id: lecture._id }
    }, mockRes, () => {});

    if (resStatus === 403) {
      console.log("   👉 Success: Blocked progress toggle for non-enrolled course lecture (HTTP 403 Forbidden)");
    } else {
      throw new Error(`Expected HTTP 403 for unauthorized progress update, but got ${resStatus}`);
    }

    // Test Case 2: Progress ObjectId Bug & Toggle
    console.log("\n🧪 Running Test 2: Progress Toggle on Enrolled Course...");
    // Enroll user in the course
    testUser.subscription.push(premiumCourse._id);
    await testUser.save();

    await updateProgress({
      user: { _id: testUser._id },
      params: { id: lecture._id }
    }, mockRes, () => {});

    const updatedUser1 = await User.findById(testUser._id);
    if (updatedUser1.completedLectures.map(String).includes(lecture._id.toString())) {
      console.log("   👉 Success: Completed lecture successfully added to progress list");
    } else {
      throw new Error("Expected completed lecture to be recorded in subscription list");
    }

    // Toggle again (should uncheck / remove it)
    await updateProgress({
      user: { _id: testUser._id },
      params: { id: lecture._id }
    }, mockRes, () => {});

    const updatedUser2 = await User.findById(testUser._id);
    if (!updatedUser2.completedLectures.map(String).includes(lecture._id.toString())) {
      console.log("   👉 Success: Completed lecture successfully toggled off (unchecked)");
    } else {
      throw new Error("Expected completed lecture to be toggled off upon second click");
    }

    // Test Case 3: Payment Price Spoofing Protection (IDOR)
    console.log("\n🧪 Running Test 3: Payment Course/Price Mismatch Reject...");
    const fakeOrderId = "order_mismatch123";
    
    // Create an order associated with Cheap Course A (₹100)
    await Order.create({
      orderId: fakeOrderId,
      user: testUser._id,
      course: cheapCourse._id,
      amount: cheapCourse.price,
    });

    // Try to verify payment of this ₹100 order against the Premium Course B (₹5000)
    await paymentVerification({
      user: { _id: testUser._id },
      params: { id: premiumCourse._id }, // Premium Course B
      body: {
        razorpay_order_id: fakeOrderId,
        razorpay_payment_id: "pay_dummy123",
        razorpay_signature: "sig_dummy123"
      }
    }, mockRes, () => {});

    if (resStatus === 400 && resData.message.includes("course mismatch")) {
      console.log("   👉 Success: Rejected checkout verification for order course mismatch (HTTP 400)");
    } else {
      throw new Error(`Expected HTTP 400 course mismatch error, but got HTTP ${resStatus}: ${JSON.stringify(resData)}`);
    }

    // Test Case 4: Payment Replay Protection
    console.log("\n🧪 Running Test 4: Payment Replay Idempotency...");
    // Mock signature match to simulate verification
    await Payment.create({
      razorpay_order_id: "order_replay123",
      razorpay_payment_id: "pay_replay123",
      razorpay_signature: "sig_replay123",
      user: testUser._id,
      course: cheapCourse._id,
    });

    // Try to verify the exact same payment ID again
    await paymentVerification({
      user: { _id: testUser._id },
      params: { id: cheapCourse._id },
      body: {
        razorpay_order_id: "order_replay123",
        razorpay_payment_id: "pay_replay123",
        razorpay_signature: "sig_replay123"
      }
    }, mockRes, () => {});

    if (resStatus === 400 && resData.message.includes("already processed")) {
      console.log("   👉 Success: Blocked payment replay attempt of processed checkout transaction");
    } else {
      throw new Error(`Expected HTTP 400 replay error, but got HTTP ${resStatus}: ${JSON.stringify(resData)}`);
    }

    console.log("\n✅ ALL LearnSphere security tests passed successfully!");
  } finally {
    // Clean up database test records
    await User.findByIdAndDelete(testUser._id);
    await Courses.findByIdAndDelete(cheapCourse._id);
    await Courses.findByIdAndDelete(premiumCourse._id);
    await Lecture.findByIdAndDelete(lecture._id);
    await Order.deleteMany({ user: testUser._id });
    await Payment.deleteMany({ user: testUser._id });
    await mongoose.connection.close();
    console.log("🧹 Cleaned up mock database records and closed database connection.");
  }
};

runTests().catch(async (err) => {
  console.error("❌ Test verification failed with error:", err);
  await mongoose.connection.close();
  process.exit(1);
});
