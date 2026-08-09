import { User } from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sendMail from "../middlewares/sendMail.js";
import TryCatch from "../middlewares/TryCatch.js";
export const register = TryCatch(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "Please fill all required fields",
    });
  }

  let user = await User.findOne({ email });
  if (user) {
    return res.status(400).json({
      message: "User already exists",
    });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  user = {
    name,
    email,
    password: hashedPassword,
  };

  const otp = Math.floor(100000 + Math.random() * 900000);
  const activationToken = jwt.sign(
    {
      user,
      otp,
    },
    process.env.Activation_Secret,
    {
      expiresIn: "15m",
    }
  );
  const data = {
    name,
    otp,
  };
  await sendMail(email, "LearnSphere", data);
  res.status(200).json({
    message: "Email has been sent",
    activationToken,
  });
});

export const verifyUser = TryCatch(async (req, res) => {
  const { otp, activationToken } = req.body;
  
  if (!otp || !activationToken) {
    return res.status(400).json({
      message: "OTP and activation token are required",
    });
  }

  const verify = jwt.verify(activationToken, process.env.Activation_Secret);
  if (!verify) {
    return res.status(400).json({
      message: "expired token",
    });
  }
  if (verify.otp !== otp) {
    return res.status(400).json({
      message: "Invalid OTP",
    });
  }
  await User.create({
    name: verify.user.name,
    email: verify.user.email,
    password: verify.user.password,
  });
  res.status(200).json({
    message: "User registered successfully",
  });
});

export const loginUser = TryCatch(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Please enter email and password",
    });
  }

  const user = await User.findOne({ email });
  if (!user)
    return res.status(400).json({
      message: "User not found",
    });
  const matchPassword = await bcrypt.compare(password, user.password);
  if (!matchPassword) {
    return res.status(400).json({
      message: "Invalid credentials",
    });
  }
  const token = jwt.sign({ _id: user._id }, process.env.Jwt_Sec, {
    expiresIn: "30d",
  });
  res.json({
    message: `welcome back ${user.name}`,
    token,
    user,
  });
});

export const myProfile = TryCatch(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ user });
});
