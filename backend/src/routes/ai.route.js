import express from "express";

import { detectMessageImage, detectMessageLinks, detectMessageText } from "../controllers/ai.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/messages/:id/detect-image", protectRoute, detectMessageImage);
router.post("/messages/:id/detect-text", protectRoute, detectMessageText);
router.post("/messages/:id/detect-link", protectRoute, detectMessageLinks);

export default router;
