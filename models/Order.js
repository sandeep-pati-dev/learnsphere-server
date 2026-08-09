import mongoose from "mongoose";

const schema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Courses",
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    default: "created", // created, verified
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600, // 1 hour TTL
  },
});

export const Order = mongoose.model("Order", schema);
