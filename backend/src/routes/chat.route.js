import express from "express";

import {
  clearConversation,
  deleteMessage,
  garbageCollectHiddenMessages,
  getMessages,
  getWebSocketToken,
  hideMessageForUser,
  uploadAttachment,
} from "../controllers/chat.controller.js";
import { uploadChatAttachment } from "../middleware/upload.middleware.js";
import { protectRoute, requireMaintenanceKey } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/token", protectRoute, getWebSocketToken);
router.get("/messages/:id", protectRoute, getMessages);
router.delete("/messages/:id", protectRoute, deleteMessage);
router.post("/messages/:id/hide", protectRoute, hideMessageForUser);
router.post("/conversations/:id/clear", protectRoute, clearConversation);
router.post("/maintenance/garbage-collect-hidden", requireMaintenanceKey, garbageCollectHiddenMessages);
router.post("/upload", protectRoute, uploadChatAttachment.single("file"), uploadAttachment);

export default router;
