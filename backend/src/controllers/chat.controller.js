import { signWebSocketToken } from "../lib/auth.js";
import { query } from "../lib/db.js";
import { serializeMessage } from "../lib/formatters.js";

const getConversationId = (userA, userB) => [userA, userB].sort().join(":");

const markConversationAsRead = async (userId, conversationId) => {
  const result = await query(
    `
      INSERT INTO conversation_reads (user_id, conversation_id, last_read_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id, conversation_id)
      DO UPDATE SET last_read_at = EXCLUDED.last_read_at
      RETURNING last_read_at
    `,
    [userId, conversationId]
  );

  return result.rows[0]?.last_read_at || null;
};

export async function getWebSocketToken(req, res) {
  try {
    const token = signWebSocketToken(req.user._id);
    res.status(200).json({ token });
  } catch (error) {
    console.error("Error in getWebSocketToken controller:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getMessages(req, res) {
  try {
    const currentUserId = req.user._id;
    const { id: targetUserId } = req.params;

    const conversationId = getConversationId(currentUserId, targetUserId);

    const result = await query(
      `
        SELECT m.id, m.conversation_id, m.sender_id, m.recipient_id, m.text, m.message_type, m.metadata,
               m.created_at,
               CASE
                 WHEN m.sender_id = $2 THEN cr.last_read_at
                 ELSE NULL
               END AS recipient_read_at
        FROM messages m
        LEFT JOIN conversation_reads cr
          ON cr.user_id = m.recipient_id
         AND cr.conversation_id = m.conversation_id
        WHERE m.conversation_id = $1
          AND m.id NOT IN (
            SELECT message_id
            FROM hidden_messages
            WHERE user_id = $2
          )
        ORDER BY m.created_at ASC
      `,
      [conversationId, currentUserId]
    );

    await markConversationAsRead(currentUserId, conversationId);
    res.status(200).json(result.rows.map(serializeMessage));
  } catch (error) {
    console.error("Error in getMessages controller:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function deleteMessage(req, res) {
  try {
    const { id: messageId } = req.params;

    const deletedMessage = await query(
      `
        DELETE FROM messages
        WHERE id = $1
          AND sender_id = $2
        RETURNING id
      `,
      [messageId, req.user._id]
    );

    if (!deletedMessage.rows[0]) {
      return res.status(404).json({ message: "Message not found or not allowed" });
    }

    res.status(200).json({ success: true, deletedMessageId: deletedMessage.rows[0].id });
  } catch (error) {
    console.error("Error in deleteMessage controller:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function hideMessageForUser(req, res) {
  try {
    const { id: messageId } = req.params;
    const userId = req.user._id;

    const messageResult = await query(
      `
        SELECT id
        FROM messages
        WHERE id = $1
          AND (sender_id = $2 OR recipient_id = $2)
      `,
      [messageId, userId]
    );

    if (!messageResult.rows[0]) {
      return res.status(404).json({ message: "Message not found" });
    }

    await query(
      `
        INSERT INTO hidden_messages (user_id, message_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [userId, messageId]
    );

    res.status(200).json({ success: true, hiddenMessageId: messageId });
  } catch (error) {
    console.error("Error in hideMessageForUser controller:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function clearConversation(req, res) {
  try {
    const currentUserId = req.user._id;
    const { id: targetUserId } = req.params;
    const conversationId = getConversationId(currentUserId, targetUserId);

    await query(
      `
        INSERT INTO hidden_messages (user_id, message_id)
        SELECT $2, id
        FROM messages
        WHERE conversation_id = $1
        ON CONFLICT DO NOTHING
      `,
      [conversationId, currentUserId]
    );

    res.status(200).json({ success: true, conversationId });
  } catch (error) {
    console.error("Error in clearConversation controller:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function garbageCollectHiddenMessages(req, res) {
  try {
    const deletedMessages = await query(
      `
        DELETE FROM messages m
        WHERE EXISTS (
          SELECT 1
          FROM hidden_messages hm_sender
          WHERE hm_sender.message_id = m.id
            AND hm_sender.user_id = m.sender_id
        )
          AND EXISTS (
            SELECT 1
            FROM hidden_messages hm_recipient
            WHERE hm_recipient.message_id = m.id
              AND hm_recipient.user_id = m.recipient_id
          )
        RETURNING id, conversation_id
      `
    );

    res.status(200).json({
      success: true,
      deletedCount: deletedMessages.rowCount,
      deletedMessageIds: deletedMessages.rows.map((row) => row.id),
    });
  } catch (error) {
    console.error("Error in garbageCollectHiddenMessages controller:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function uploadAttachment(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const mimeType = req.file.mimetype || "application/octet-stream";

    let attachmentType = "file";
    if (mimeType.startsWith("image/")) attachmentType = "image";
    if (mimeType.startsWith("video/")) attachmentType = "video";
    if (mimeType.startsWith("audio/")) attachmentType = "audio";

    res.status(201).json({
      attachment: {
        name: req.file.originalname,
        mimeType,
        size: req.file.size,
        type: attachmentType,
        url: `${baseUrl}/uploads/chat/${req.file.filename}`,
      },
    });
  } catch (error) {
    console.error("Error in uploadAttachment controller:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
