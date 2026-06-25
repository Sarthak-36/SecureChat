import express from "express";
import {
  deleteAccount,
  login,
  logout,
  onboard,
  requestSignupOtp,
  signup,
  updateProfile,
  uploadProfilePicture,
  verifySignupOtp,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { uploadProfileImage } from "../middleware/upload.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/signup/request-otp", requestSignupOtp);
router.post("/signup/verify-otp", verifySignupOtp);
router.post("/login", login);
router.post("/logout", logout);

router.post("/onboarding", protectRoute, onboard);
router.put("/profile", protectRoute, updateProfile);
router.post("/profile-picture", protectRoute, uploadProfileImage.single("file"), uploadProfilePicture);
router.delete("/account", protectRoute, deleteAccount);

// check if user is logged in
router.get("/me", protectRoute, (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

export default router;
