import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  acceptFriendRequest,
  clearAcceptedFriendRequestNotifications,
  getFriendRequests,
  getMyFriends,
  getOutgoingFriendReqs,
  getRecommendedUsers,
  getUnreadNotificationCount,
  hideAcceptedFriendRequestNotification,
  markNotificationsRead,
  removeFriend,
  sendFriendRequest,
} from "../controllers/user.controller.js";

const router = express.Router();

// apply auth middleware to all routes
router.use(protectRoute);

router.get("/", getRecommendedUsers);
router.get("/friends", getMyFriends);
router.delete("/friends/:id", removeFriend);

router.post("/friend-request/:id", sendFriendRequest);
router.put("/friend-request/:id/accept", acceptFriendRequest);

router.get("/friend-requests", getFriendRequests);
router.get("/outgoing-friend-requests", getOutgoingFriendReqs);
router.get("/notifications/unread-count", getUnreadNotificationCount);
router.post("/notifications/mark-read", markNotificationsRead);
router.delete("/notifications/accepted-friend-requests", clearAcceptedFriendRequestNotifications);
router.delete("/notifications/accepted-friend-requests/:id", hideAcceptedFriendRequestNotification);

export default router;
