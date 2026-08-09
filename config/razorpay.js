import Razorpay from "razorpay";
import dotenv from "dotenv";
dotenv.config();

export const instance = new Razorpay({
  key_id: process.env.Razorpay_key,
  key_secret: process.env.Razorpay_Secret,
});
