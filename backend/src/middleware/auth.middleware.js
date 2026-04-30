import { verifyAuthToken } from "../lib/auth.js";
import { getUserById } from "../lib/users.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    const decoded = verifyAuthToken(token);
    const user = await getUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "Unauthorized - User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Error in protectRoute middleware", error);
    res.status(401).json({ message: "Unauthorized" });
  }
};

export const requireMaintenanceKey = (req, res, next) => {
  const configuredKey = process.env.MAINTENANCE_API_KEY;

  if (!configuredKey) {
    return res.status(503).json({ message: "Maintenance route is not configured" });
  }

  const providedKey = req.headers["x-maintenance-key"];

  if (providedKey !== configuredKey) {
    return res.status(403).json({ message: "Forbidden" });
  }

  next();
};
