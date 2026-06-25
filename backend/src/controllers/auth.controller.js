import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

import { cookieOptions, signAuthToken } from "../lib/auth.js";
import { query } from "../lib/db.js";
import { serializeUser } from "../lib/formatters.js";
import { getUserWithPasswordByEmail } from "../lib/users.js";
import { sendOtpEmail } from "../lib/email.js";

const DEFAULT_PROFILE_PIC = "/default-avatar.svg";
const normalizeProfilePic = (profilePic) => {
  const normalizedProfilePic = typeof profilePic === "string" ? profilePic.trim() : "";
  return normalizedProfilePic || DEFAULT_PROFILE_PIC;
};

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

export async function requestSignupOtp(req, res) {
  const { email, password, fullName } = req.body;

  try {
    if (!email || !password || !fullName) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existingUser = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existingUser.rows[0]) {
      return res.status(400).json({ message: "Email already exists, please use a different one" });
    }

    await query("UPDATE registration_otps SET used = TRUE WHERE email = $1 AND used = FALSE", [email]);

    const otp = generateOtp();
    const hashedPassword = await bcrypt.hash(password, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await query(
      `
        INSERT INTO registration_otps (id, email, full_name, password, otp, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [randomUUID(), email, fullName, hashedPassword, otp, expiresAt]
    );

    await sendOtpEmail(email, fullName, otp);

    res.status(200).json({
      success: true,
      message: "OTP sent to your email. It expires in 10 minutes.",
    });
  } catch (error) {
    console.error("Error sending signup OTP", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function verifySignupOtp(req, res) {
  const { email, otp } = req.body;

  try {
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const existingOtpResult = await query(
      `
        SELECT id, full_name, password, otp, used, expires_at
        FROM registration_otps
        WHERE email = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [email]
    );

    const registrationOtp = existingOtpResult.rows[0];
    if (!registrationOtp || registrationOtp.used) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const expiresAt = new Date(registrationOtp.expires_at);
    if (expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    if (registrationOtp.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const existingUser = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existingUser.rows[0]) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const userId = randomUUID();
    const createdUser = await query(
      `
        INSERT INTO users (id, email, password, full_name, profile_pic)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, full_name, bio, profile_pic,
                  location, is_onboarded, created_at, updated_at
      `,
      [userId, email, registrationOtp.password, registrationOtp.full_name, DEFAULT_PROFILE_PIC]
    );

    await query("UPDATE registration_otps SET used = TRUE WHERE id = $1", [registrationOtp.id]);

    const token = signAuthToken(userId);
    res.cookie("jwt", token, cookieOptions);

    res.status(201).json({ success: true, user: serializeUser(createdUser.rows[0]) });
  } catch (error) {
    console.error("Error verifying signup OTP", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function signup(req, res) {
  const { email, password, fullName } = req.body;

  try {
    if (!email || !password || !fullName) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existingUser = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existingUser.rows[0]) {
      return res.status(400).json({ message: "Email already exists, please use a different one" });
    }

    const userId = randomUUID();
    const hashedPassword = await bcrypt.hash(password, 10);
    const createdUser = await query(
      `
        INSERT INTO users (id, email, password, full_name, profile_pic)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, full_name, bio, profile_pic,
                  location, is_onboarded, created_at, updated_at
      `,
      [userId, email, hashedPassword, fullName, DEFAULT_PROFILE_PIC]
    );

    const token = signAuthToken(userId);
    res.cookie("jwt", token, cookieOptions);

    res.status(201).json({ success: true, user: serializeUser(createdUser.rows[0]) });
  } catch (error) {
    console.error("Error in signup controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await getUserWithPasswordByEmail(email);
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) return res.status(401).json({ message: "Invalid email or password" });

    const token = signAuthToken(user.id);
    res.cookie("jwt", token, cookieOptions);

    res.status(200).json({ success: true, user: serializeUser(user) });
  } catch (error) {
    console.error("Error in login controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export function logout(req, res) {
  res.clearCookie("jwt", cookieOptions);
  res.status(200).json({ success: true, message: "Logout successful" });
}

export async function onboard(req, res) {
  try {
    const userId = req.user._id;
    const { fullName, bio, location, profilePic } = req.body;

    if (!fullName || !bio || !location) {
      return res.status(400).json({
        message: "All fields are required",
        missingFields: [
          !fullName && "fullName",
          !bio && "bio",
          !location && "location",
        ].filter(Boolean),
      });
    }

    const updatedUser = await query(
      `
        UPDATE users
        SET full_name = $2,
            bio = $3,
            location = $4,
            profile_pic = $5,
            is_onboarded = TRUE,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, full_name, bio, profile_pic,
                  location, is_onboarded, created_at, updated_at
      `,
      [userId, fullName, bio, location, normalizeProfilePic(profilePic)]
    );

    if (!updatedUser.rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ success: true, user: serializeUser(updatedUser.rows[0]) });
  } catch (error) {
    console.error("Onboarding error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function updateProfile(req, res) {
  try {
    const userId = req.user._id;
    const { fullName, bio, location, profilePic } = req.body;

    if (!fullName || !bio || !location) {
      return res.status(400).json({
        message: "Full name, bio, and location are required",
      });
    }

    const updatedUser = await query(
      `
        UPDATE users
        SET full_name = $2,
            bio = $3,
            location = $4,
            profile_pic = $5,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, full_name, bio, profile_pic,
                  location, is_onboarded, created_at, updated_at
      `,
      [userId, fullName, bio, location, normalizeProfilePic(profilePic)]
    );

    if (!updatedUser.rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ success: true, user: serializeUser(updatedUser.rows[0]) });
  } catch (error) {
    console.error("Error in updateProfile controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function uploadProfilePicture(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const imageUrl = `${baseUrl}/uploads/profiles/${req.file.filename}`;

    await query(
      `
        UPDATE users
        SET profile_pic = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [req.user._id, imageUrl]
    );

    res.status(201).json({ profilePic: imageUrl });
  } catch (error) {
    console.error("Error in uploadProfilePicture controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function deleteAccount(req, res) {
  try {
    const deletedUser = await query("DELETE FROM users WHERE id = $1 RETURNING id", [req.user._id]);

    if (!deletedUser.rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }

    res.clearCookie("jwt", cookieOptions);
    res.status(200).json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error in deleteAccount controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
