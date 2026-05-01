import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import {
  analyzeImageContent,
  analyzeLinkContent,
  analyzeTextContent,
  describeImageContent,
  CURRENT_TEXT_AI_MODELS,
  summarizeTextContent,
  translateTextToEnglish,
} from "../lib/ai.js";
import { query } from "../lib/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "../..");
const uploadsRoot = path.join(backendRoot, "uploads");

const getAttachmentFromMessage = (message) => {
  const attachments = Array.isArray(message?.metadata?.attachments) ? message.metadata.attachments : [];
  return attachments[0] || null;
};
const urlPattern = /(?:https?:\/\/|www\.)[^\s<>"')]+/gi;

const resolveAttachmentPath = (attachmentUrl) => {
  const parsedUrl = new URL(attachmentUrl, "http://localhost");
  const relativePath = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));
  const absolutePath = path.resolve(backendRoot, relativePath);

  if (!absolutePath.startsWith(uploadsRoot)) {
    const error = new Error("Attachment path is outside uploads directory");
    error.statusCode = 400;
    error.publicMessage = "This attachment cannot be scanned";
    throw error;
  }

  return absolutePath;
};

const getAccessibleMessage = async ({ messageId, currentUserId }) => {
  const messageResult = await query(
    `
      SELECT id, sender_id, recipient_id, text, metadata, created_at
      FROM messages
      WHERE id = $1
        AND (sender_id = $2 OR recipient_id = $2)
    `,
    [messageId, currentUserId]
  );

  return messageResult.rows[0] || null;
};

const extractLinksFromText = (text = "") => {
  const matches = text.match(urlPattern) || [];
  return [
    ...new Set(
      matches.map((match) => (match.startsWith("http://") || match.startsWith("https://") ? match : `https://${match}`))
    ),
  ];
};

const getCachedCheck = async ({ messageId, checkType }) => {
  const result = await query(
    `
      SELECT payload, created_at, updated_at
      FROM ai_message_checks
      WHERE message_id = $1
        AND check_type = $2
    `,
    [messageId, checkType]
  );

  return result.rows[0] || null;
};

const upsertCachedCheck = async ({ messageId, checkType, payload }) => {
  await query(
    `
      INSERT INTO ai_message_checks (message_id, check_type, payload, updated_at)
      VALUES ($1, $2, $3::jsonb, NOW())
      ON CONFLICT (message_id, check_type)
      DO UPDATE SET
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `,
    [messageId, checkType, JSON.stringify(payload)]
  );
};

const respondWithCachedCheck = (res, cachedRow) => {
  res.status(200).json({
    ...cachedRow.payload,
    cached: true,
    cachedAt: cachedRow.updated_at,
    cacheStatus: "reused",
  });
};

const isTextCheckCacheCompatible = (cachedRow) => {
  const cachedModels = [cachedRow?.payload?.analysis?.models?.aiGeneratedText].filter(Boolean);

  if (!cachedRow?.payload?.analysis?.aiGeneratedText?.summary) {
    return false;
  }

  return CURRENT_TEXT_AI_MODELS.every((model) => cachedModels.includes(model));
};

const isImageDescriptionCacheCompatible = (cachedRow) =>
  Boolean(
    cachedRow?.payload?.description?.descriptionText &&
      cachedRow?.payload?.description?.models?.imageDescription
  );

export async function detectMessageImage(req, res) {
  try {
    const { id: messageId } = req.params;
    const currentUserId = req.user._id;
    const force = Boolean(req.body?.force);
    const message = await getAccessibleMessage({ messageId, currentUserId });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const attachment = getAttachmentFromMessage(message);

    if (!attachment?.url || attachment.type !== "image") {
      return res.status(400).json({ message: "AI detection only supports image attachments right now" });
    }

    if (!force) {
      const cachedCheck = await getCachedCheck({ messageId, checkType: "image" });
      if (cachedCheck) {
        return respondWithCachedCheck(res, cachedCheck);
      }
    }

    const filePath = resolveAttachmentPath(attachment.url);
    const fileBuffer = await fs.readFile(filePath);

    const analysis = await analyzeImageContent({
      buffer: fileBuffer,
      mimeType: attachment.mimeType,
    });
    const payload = {
      success: true,
      messageId,
      checkType: "image",
      attachment: {
        name: attachment.name,
        type: attachment.type,
        mimeType: attachment.mimeType,
        url: attachment.url,
      },
      analysis,
    };

    await upsertCachedCheck({ messageId, checkType: "image", payload });

    res.status(200).json({
      ...payload,
      cached: false,
      cachedAt: analysis.checkedAt,
    });
  } catch (error) {
    console.error("Error in detectMessageImage controller:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.publicMessage || "Internal Server Error" });
  }
}

export async function detectMessageText(req, res) {
  try {
    const { id: messageId } = req.params;
    const currentUserId = req.user._id;
    const force = Boolean(req.body?.force);
    const message = await getAccessibleMessage({ messageId, currentUserId });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const text = message.text?.trim();

    if (!text) {
      return res.status(400).json({ message: "AI text detection only supports messages with text" });
    }

    if (!force) {
      const cachedCheck = await getCachedCheck({ messageId, checkType: "text" });
      if (cachedCheck && isTextCheckCacheCompatible(cachedCheck)) {
        return respondWithCachedCheck(res, cachedCheck);
      }
    }

    const analysis = await analyzeTextContent({ text });
    const payload = {
      success: true,
      messageId,
      checkType: "text",
      text,
      analysis,
    };

    await upsertCachedCheck({ messageId, checkType: "text", payload });

    res.status(200).json({
      ...payload,
      cached: false,
      cachedAt: analysis.checkedAt,
    });
  } catch (error) {
    console.error("Error in detectMessageText controller:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.publicMessage || "Internal Server Error" });
  }
}

export async function detectMessageLinks(req, res) {
  try {
    const { id: messageId } = req.params;
    const currentUserId = req.user._id;
    const force = Boolean(req.body?.force);
    const message = await getAccessibleMessage({ messageId, currentUserId });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const text = message.text?.trim();
    const links = extractLinksFromText(text);

    if (!text || links.length === 0) {
      return res.status(400).json({ message: "Suspicious link check needs a message with at least one link" });
    }

    if (!force) {
      const cachedCheck = await getCachedCheck({ messageId, checkType: "link" });
      if (cachedCheck) {
        return respondWithCachedCheck(res, cachedCheck);
      }
    }

    const analysis = await analyzeLinkContent({ text, links });
    const payload = {
      success: true,
      messageId,
      checkType: "link",
      text,
      extractedLinks: links,
      analysis,
    };

    await upsertCachedCheck({ messageId, checkType: "link", payload });

    res.status(200).json({
      ...payload,
      cached: false,
      cachedAt: analysis.checkedAt,
    });
  } catch (error) {
    console.error("Error in detectMessageLinks controller:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.publicMessage || "Internal Server Error" });
  }
}

export async function translateMessageToEnglish(req, res) {
  try {
    const { id: messageId } = req.params;
    const currentUserId = req.user._id;
    const force = Boolean(req.body?.force);
    const message = await getAccessibleMessage({ messageId, currentUserId });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const text = message.text?.trim();

    if (!text) {
      return res.status(400).json({ message: "Translation only supports messages with text" });
    }

    if (!force) {
      const cachedCheck = await getCachedCheck({ messageId, checkType: "translate" });
      if (cachedCheck) {
        return respondWithCachedCheck(res, cachedCheck);
      }
    }

    const translation = await translateTextToEnglish({ text });
    const payload = {
      success: true,
      messageId,
      checkType: "translate",
      text,
      translation,
    };

    await upsertCachedCheck({ messageId, checkType: "translate", payload });

    res.status(200).json({
      ...payload,
      cached: false,
      cachedAt: translation.checkedAt,
      cacheStatus: force ? "refreshed" : "fresh",
    });
  } catch (error) {
    console.error("Error in translateMessageToEnglish controller:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.publicMessage || "Internal Server Error" });
  }
}

export async function summarizeMessageText(req, res) {
  try {
    const { id: messageId } = req.params;
    const currentUserId = req.user._id;
    const force = Boolean(req.body?.force);
    const message = await getAccessibleMessage({ messageId, currentUserId });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const text = message.text?.trim();

    if (!text) {
      return res.status(400).json({ message: "Summarization only supports messages with text" });
    }

    if (!force) {
      const cachedCheck = await getCachedCheck({ messageId, checkType: "summarize" });
      if (cachedCheck) {
        return respondWithCachedCheck(res, cachedCheck);
      }
    }

    const summary = await summarizeTextContent({ text });
    const payload = {
      success: true,
      messageId,
      checkType: "summarize",
      text,
      summary,
    };

    await upsertCachedCheck({ messageId, checkType: "summarize", payload });

    res.status(200).json({
      ...payload,
      cached: false,
      cachedAt: summary.checkedAt,
      cacheStatus: force ? "refreshed" : "fresh",
    });
  } catch (error) {
    console.error("Error in summarizeMessageText controller:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.publicMessage || "Internal Server Error" });
  }
}

export async function describeMessageImage(req, res) {
  try {
    const { id: messageId } = req.params;
    const currentUserId = req.user._id;
    const force = Boolean(req.body?.force);
    const message = await getAccessibleMessage({ messageId, currentUserId });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const attachment = getAttachmentFromMessage(message);

    if (!attachment?.url || attachment.type !== "image") {
      return res.status(400).json({ message: "Image description only supports image attachments" });
    }

    if (!force) {
      const cachedCheck = await getCachedCheck({ messageId, checkType: "describe_image" });
      if (cachedCheck && isImageDescriptionCacheCompatible(cachedCheck)) {
        return respondWithCachedCheck(res, cachedCheck);
      }
    }

    const filePath = resolveAttachmentPath(attachment.url);
    const fileBuffer = await fs.readFile(filePath);
    const description = await describeImageContent({
      buffer: fileBuffer,
      mimeType: attachment.mimeType,
      attachmentName: attachment.name,
    });
    const payload = {
      success: true,
      messageId,
      checkType: "describe_image",
      attachment: {
        name: attachment.name,
        type: attachment.type,
        mimeType: attachment.mimeType,
        url: attachment.url,
      },
      description,
    };

    await upsertCachedCheck({ messageId, checkType: "describe_image", payload });

    res.status(200).json({
      ...payload,
      cached: false,
      cachedAt: description.checkedAt,
      cacheStatus: force ? "refreshed" : "fresh",
    });
  } catch (error) {
    console.error("Error in describeMessageImage controller:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.publicMessage || "Internal Server Error" });
  }
}
