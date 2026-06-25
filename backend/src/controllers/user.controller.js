import { randomUUID } from "crypto";

import { query, withTransaction } from "../lib/db.js";
import { serializeFriendRequestRow, serializeFriendSummary, serializeUser } from "../lib/formatters.js";

export async function getRecommendedUsers(req, res) {
  try {
    const currentUserId = req.user._id;

    const recommendedUsers = await query(
      `
        SELECT id, email, full_name, bio, profile_pic,
               location, is_onboarded, created_at, updated_at
        FROM users
        WHERE id <> $1
          AND is_onboarded = TRUE
          AND id NOT IN (
            SELECT friend_id
            FROM friendships
            WHERE user_id = $1
          )
        ORDER BY created_at DESC
      `,
      [currentUserId]
    );

    res.status(200).json(recommendedUsers.rows.map(serializeUser));
  } catch (error) {
    console.error("Error in getRecommendedUsers controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getMyFriends(req, res) {
  try {
    const result = await query(
      `
        SELECT u.id, u.email, u.full_name, u.bio, u.profile_pic,
               u.location, u.is_onboarded, u.created_at, u.updated_at,
               CONCAT(LEAST($1::text, u.id::text), ':', GREATEST($1::text, u.id::text)) AS conversation_id,
               latest_message.text AS last_message_text,
               latest_message.created_at AS last_message_created_at,
               COALESCE(unread_stats.unread_count, 0) AS unread_count
        FROM friendships f
        INNER JOIN users u ON u.id = f.friend_id
        LEFT JOIN LATERAL (
          SELECT m.text, m.created_at
          FROM messages m
          WHERE m.conversation_id = CONCAT(LEAST($1::text, u.id::text), ':', GREATEST($1::text, u.id::text))
            AND m.id NOT IN (
              SELECT hm.message_id
              FROM hidden_messages hm
              WHERE hm.user_id = $1::uuid
            )
          ORDER BY m.created_at DESC
          LIMIT 1
        ) latest_message ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::INT AS unread_count
          FROM messages m
          LEFT JOIN conversation_reads cr
            ON cr.user_id = $1::uuid
           AND cr.conversation_id = CONCAT(LEAST($1::text, u.id::text), ':', GREATEST($1::text, u.id::text))
          WHERE m.conversation_id = CONCAT(LEAST($1::text, u.id::text), ':', GREATEST($1::text, u.id::text))
            AND m.recipient_id = $1::uuid
            AND m.created_at > COALESCE(cr.last_read_at, TO_TIMESTAMP(0))
            AND m.id NOT IN (
              SELECT hm.message_id
              FROM hidden_messages hm
              WHERE hm.user_id = $1::uuid
            )
        ) unread_stats ON TRUE
        WHERE f.user_id = $1::uuid
        ORDER BY
          latest_message.created_at DESC NULLS LAST,
          COALESCE(unread_stats.unread_count, 0) DESC,
          u.full_name ASC
      `,
      [req.user._id]
    );

    res.status(200).json(result.rows.map(serializeFriendSummary));
  } catch (error) {
    console.error("Error in getMyFriends controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function sendFriendRequest(req, res) {
  try {
    const myId = req.user._id;
    const { id: recipientId } = req.params;

    if (myId === recipientId) {
      return res.status(400).json({ message: "You can't send a friend request to yourself" });
    }

    const recipient = await query("SELECT id FROM users WHERE id = $1", [recipientId]);
    if (!recipient.rows[0]) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    const isAlreadyFriend = await query(
      "SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = $2",
      [myId, recipientId]
    );

    if (isAlreadyFriend.rows[0]) {
      return res.status(400).json({ message: "You are already friends with this user" });
    }

    const existingRequest = await query(
      `
        SELECT id
        FROM friend_requests
        WHERE (sender_id = $1 AND recipient_id = $2)
           OR (sender_id = $2 AND recipient_id = $1)
      `,
      [myId, recipientId]
    );

    if (existingRequest.rows[0]) {
      return res
        .status(400)
        .json({ message: "A friend request already exists between you and this user" });
    }

    const friendRequest = await query(
      `
        INSERT INTO friend_requests (id, sender_id, recipient_id)
        VALUES ($1, $2, $3)
        RETURNING id, sender_id, recipient_id, status, created_at, updated_at
      `,
      [randomUUID(), myId, recipientId]
    );

    res.status(201).json({
      _id: friendRequest.rows[0].id,
      sender: friendRequest.rows[0].sender_id,
      recipient: friendRequest.rows[0].recipient_id,
      status: friendRequest.rows[0].status,
      createdAt: friendRequest.rows[0].created_at,
      updatedAt: friendRequest.rows[0].updated_at,
    });
  } catch (error) {
    console.error("Error in sendFriendRequest controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function acceptFriendRequest(req, res) {
  try {
    const { id: requestId } = req.params;

    const friendRequest = await query(
      `
        SELECT id, sender_id, recipient_id, status
        FROM friend_requests
        WHERE id = $1
      `,
      [requestId]
    );

    const request = friendRequest.rows[0];

    if (!request) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    if (request.recipient_id !== req.user._id) {
      return res.status(403).json({ message: "You are not authorized to accept this request" });
    }

    await withTransaction(async (client) => {
      await client.query(
        `
          UPDATE friend_requests
          SET status = 'accepted', updated_at = NOW()
          WHERE id = $1
        `,
        [requestId]
      );

      await client.query(
        `
          INSERT INTO friendships (user_id, friend_id)
          VALUES ($1, $2), ($2, $1)
          ON CONFLICT DO NOTHING
        `,
        [request.sender_id, request.recipient_id]
      );
    });

    res.status(200).json({ message: "Friend request accepted" });
  } catch (error) {
    console.error("Error in acceptFriendRequest controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getFriendRequests(req, res) {
  try {
    const incomingReqs = await query(
      `
        SELECT fr.id, fr.status, fr.created_at, fr.updated_at,
               (rn.source_id IS NOT NULL) AS is_read,
               u.id AS sender_id, u.full_name AS sender_full_name, u.profile_pic AS sender_profile_pic,
               u.location AS sender_location
        FROM friend_requests fr
        INNER JOIN users u ON u.id = fr.sender_id
        LEFT JOIN read_notifications rn
          ON rn.user_id = $1::uuid
         AND rn.notification_type = 'friend_request'
         AND rn.source_id = fr.id
        WHERE fr.recipient_id = $1 AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
      `,
      [req.user._id]
    );

    const acceptedSentReqs = await query(
      `
        SELECT fr.id, fr.status, fr.created_at, fr.updated_at,
               (rn.source_id IS NOT NULL) AS is_read,
               u.id AS recipient_id, u.full_name AS recipient_full_name,
               u.profile_pic AS recipient_profile_pic, u.location AS recipient_location
        FROM friend_requests fr
        INNER JOIN users u ON u.id = fr.recipient_id
        LEFT JOIN hidden_notifications hn
          ON hn.user_id = $1::uuid
         AND hn.notification_type = 'accepted_friend_request'
         AND hn.source_id = fr.id
        LEFT JOIN read_notifications rn
          ON rn.user_id = $1::uuid
         AND rn.notification_type = 'accepted_friend_request'
         AND rn.source_id = fr.id
        WHERE fr.sender_id = $1 AND fr.status = 'accepted'
          AND hn.source_id IS NULL
        ORDER BY fr.updated_at DESC
      `,
      [req.user._id]
    );

    const acceptedReceivedReqs = await query(
      `
        SELECT fr.id, fr.status, fr.created_at, fr.updated_at,
               (rn.source_id IS NOT NULL) AS is_read,
               u.id AS sender_id, u.full_name AS sender_full_name,
               u.profile_pic AS sender_profile_pic, u.location AS sender_location
        FROM friend_requests fr
        INNER JOIN users u ON u.id = fr.sender_id
        LEFT JOIN hidden_notifications hn
          ON hn.user_id = $1::uuid
         AND hn.notification_type = 'accepted_friend_request'
         AND hn.source_id = fr.id
        LEFT JOIN read_notifications rn
          ON rn.user_id = $1::uuid
         AND rn.notification_type = 'accepted_friend_request'
         AND rn.source_id = fr.id
        WHERE fr.recipient_id = $1 AND fr.status = 'accepted'
          AND hn.source_id IS NULL
        ORDER BY fr.updated_at DESC
      `,
      [req.user._id]
    );

    const acceptedReqs = [
      ...acceptedSentReqs.rows.map((row) => {
        const notification = serializeFriendRequestRow(row, "recipient");
        return {
          ...notification,
          isRead: Boolean(row.is_read),
          connection: notification.recipient,
          notificationRole: "request_sent",
          notificationText: `${notification.recipient.fullName} accepted your friend request`,
        };
      }),
      ...acceptedReceivedReqs.rows.map((row) => {
        const notification = serializeFriendRequestRow(row, "sender");
        return {
          ...notification,
          isRead: Boolean(row.is_read),
          connection: notification.sender,
          notificationRole: "request_received",
          notificationText: `You accepted ${notification.sender.fullName}'s friend request`,
        };
      }),
    ].sort((first, second) => new Date(second.updatedAt) - new Date(first.updatedAt));

    res.status(200).json({
      incomingReqs: incomingReqs.rows.map((row) => ({
        ...serializeFriendRequestRow(row, "sender"),
        isRead: Boolean(row.is_read),
      })),
      acceptedReqs,
    });
  } catch (error) {
    console.error("Error in getFriendRequests controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getUnreadNotificationCount(req, res) {
  try {
    const result = await query(
      `
        WITH visible_notifications AS (
          SELECT fr.id, 'friend_request'::text AS notification_type
          FROM friend_requests fr
          WHERE fr.recipient_id = $1::uuid
            AND fr.status = 'pending'

          UNION ALL

          SELECT fr.id, 'accepted_friend_request'::text AS notification_type
          FROM friend_requests fr
          LEFT JOIN hidden_notifications hn
            ON hn.user_id = $1::uuid
           AND hn.notification_type = 'accepted_friend_request'
           AND hn.source_id = fr.id
          WHERE fr.status = 'accepted'
            AND (fr.sender_id = $1::uuid OR fr.recipient_id = $1::uuid)
            AND hn.source_id IS NULL
        )
        SELECT COUNT(*)::INT AS unread_count
        FROM visible_notifications vn
        LEFT JOIN read_notifications rn
          ON rn.user_id = $1::uuid
         AND rn.notification_type = vn.notification_type
         AND rn.source_id = vn.id
        WHERE rn.source_id IS NULL
      `,
      [req.user._id]
    );

    res.status(200).json({ unreadCount: Number(result.rows[0]?.unread_count || 0) });
  } catch (error) {
    console.error("Error in getUnreadNotificationCount controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function markNotificationsRead(req, res) {
  try {
    const result = await query(
      `
        WITH visible_notifications AS (
          SELECT fr.id, 'friend_request'::text AS notification_type
          FROM friend_requests fr
          WHERE fr.recipient_id = $1::uuid
            AND fr.status = 'pending'

          UNION ALL

          SELECT fr.id, 'accepted_friend_request'::text AS notification_type
          FROM friend_requests fr
          LEFT JOIN hidden_notifications hn
            ON hn.user_id = $1::uuid
           AND hn.notification_type = 'accepted_friend_request'
           AND hn.source_id = fr.id
          WHERE fr.status = 'accepted'
            AND (fr.sender_id = $1::uuid OR fr.recipient_id = $1::uuid)
            AND hn.source_id IS NULL
        )
        INSERT INTO read_notifications (user_id, notification_type, source_id)
        SELECT $1::uuid, notification_type, id
        FROM visible_notifications
        ON CONFLICT DO NOTHING
        RETURNING source_id
      `,
      [req.user._id]
    );

    res.status(200).json({ success: true, markedReadCount: result.rowCount });
  } catch (error) {
    console.error("Error in markNotificationsRead controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function hideAcceptedFriendRequestNotification(req, res) {
  try {
    const { id: requestId } = req.params;

    const notification = await query(
      `
        SELECT id
        FROM friend_requests
        WHERE id = $1
          AND status = 'accepted'
          AND (sender_id = $2::uuid OR recipient_id = $2::uuid)
      `,
      [requestId, req.user._id]
    );

    if (!notification.rows[0]) {
      return res.status(404).json({ message: "Notification not found" });
    }

    await query(
      `
        INSERT INTO hidden_notifications (user_id, notification_type, source_id)
        VALUES ($1, 'accepted_friend_request', $2)
        ON CONFLICT DO NOTHING
      `,
      [req.user._id, requestId]
    );

    res.status(200).json({ success: true, hiddenNotificationId: requestId });
  } catch (error) {
    console.error("Error in hideAcceptedFriendRequestNotification controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function clearAcceptedFriendRequestNotifications(req, res) {
  try {
    const hiddenNotifications = await query(
      `
        INSERT INTO hidden_notifications (user_id, notification_type, source_id)
        SELECT $1::uuid, 'accepted_friend_request', fr.id
        FROM friend_requests fr
        WHERE fr.status = 'accepted'
          AND (fr.sender_id = $1::uuid OR fr.recipient_id = $1::uuid)
        ON CONFLICT DO NOTHING
        RETURNING source_id
      `,
      [req.user._id]
    );

    res.status(200).json({ success: true, hiddenCount: hiddenNotifications.rowCount });
  } catch (error) {
    console.error("Error in clearAcceptedFriendRequestNotifications controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getOutgoingFriendReqs(req, res) {
  try {
    const outgoingRequests = await query(
      `
        SELECT fr.id, fr.status, fr.created_at, fr.updated_at,
               u.id AS recipient_id, u.full_name AS recipient_full_name,
               u.profile_pic AS recipient_profile_pic, u.location AS recipient_location
        FROM friend_requests fr
        INNER JOIN users u ON u.id = fr.recipient_id
        WHERE fr.sender_id = $1 AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
      `,
      [req.user._id]
    );

    res.status(200).json(outgoingRequests.rows.map((row) => serializeFriendRequestRow(row, "recipient")));
  } catch (error) {
    console.error("Error in getOutgoingFriendReqs controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function removeFriend(req, res) {
  try {
    const currentUserId = req.user._id;
    const { id: friendId } = req.params;

    if (currentUserId === friendId) {
      return res.status(400).json({ message: "You cannot remove yourself from your friend list" });
    }

    const deletedFriendships = await withTransaction(async (client) => {
      const friendshipsResult = await client.query(
        `
          DELETE FROM friendships
          WHERE (user_id = $1 AND friend_id = $2)
             OR (user_id = $2 AND friend_id = $1)
          RETURNING user_id, friend_id
        `,
        [currentUserId, friendId]
      );

      if (friendshipsResult.rowCount === 0) {
        return friendshipsResult;
      }

      await client.query(
        `
          DELETE FROM friend_requests
          WHERE (sender_id = $1 AND recipient_id = $2)
             OR (sender_id = $2 AND recipient_id = $1)
        `,
        [currentUserId, friendId]
      );

      return friendshipsResult;
    });

    if (deletedFriendships.rowCount === 0) {
      return res.status(404).json({ message: "Friend not found" });
    }

    res.status(200).json({ success: true, removedFriendId: friendId });
  } catch (error) {
    console.error("Error in removeFriend controller", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
