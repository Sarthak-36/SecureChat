import express from "express";

import {
  describeMessageImage,
  detectMessageImage,
  detectMessageLinks,
  detectMessageText,
  summarizeMessageText,
  translateMessageToEnglish,
} from "../controllers/ai.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/messages/:id/detect-image", protectRoute, detectMessageImage);
router.post("/messages/:id/detect-text", protectRoute, detectMessageText);
router.post("/messages/:id/detect-link", protectRoute, detectMessageLinks);
router.post("/messages/:id/translate", protectRoute, translateMessageToEnglish);
router.post("/messages/:id/summarize", protectRoute, summarizeMessageText);
router.post("/messages/:id/describe-image", protectRoute, describeMessageImage);

export default router;
