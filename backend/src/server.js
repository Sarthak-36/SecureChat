import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import http from "http";
import "dotenv/config";
import { fileURLToPath } from "url";
import path from "path";
import { WebSocket, WebSocketServer } from "ws";
import { randomUUID } from "crypto";

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import aiRoutes from "./routes/ai.route.js";
import { connectDB, query } from "./lib/db.js";
import { parseCookies, verifyAuthToken, verifyWebSocketToken } from "./lib/auth.js";
import { getUserById } from "./lib/users.js";
import { serializeMessage } from "./lib/formatters.js";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const PORT = process.env.PORT || 5001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendRoot, "..");

const socketsByUserId = new Map();
const conversationSubscribers = new Map();
const callRooms = new Map();
const presenceSubscribers = new Map();
const pendingCallInvites = new Map();
const activeCallSessions = new Map();
const callLeaveTimers = new Map();
const endedCallEvents = new Map();
const CALL_INVITE_TIMEOUT_MS = 30_000;
const CALL_LEAVE_GRACE_MS = 1500;
const ENDED_CALL_EVENT_TTL_MS = 60_000;

const getConversationId = (userA, userB) => [userA, userB].sort().join(":");

const addSocketForUser = (userId, socket) => {
  const sockets = socketsByUserId.get(userId) || new Set();
  sockets.add(socket);
  socketsByUserId.set(userId, sockets);
};

const removeSocketForUser = (userId, socket) => {
  const sockets = socketsByUserId.get(userId);
  if (!sockets) return;

  sockets.delete(socket);
  if (sockets.size === 0) {
    socketsByUserId.delete(userId);
  }
};

const joinSetMap = (map, key, socket) => {
  const sockets = map.get(key) || new Set();
  sockets.add(socket);
  map.set(key, sockets);
};

const removeFromSetMap = (map, key, socket) => {
  const sockets = map.get(key);
  if (!sockets) return;

  sockets.delete(socket);
  if (sockets.size === 0) {
    map.delete(key);
  }
};

const getCallUserKey = (callId, userId) => `${callId}:${userId}`;

const clearScheduledCallLeave = (callId, userId) => {
  if (!callId || !userId) return;

  const callUserKey = getCallUserKey(callId, userId);
  const leaveTimer = callLeaveTimers.get(callUserKey);

  if (!leaveTimer) return;

  clearTimeout(leaveTimer);
  callLeaveTimers.delete(callUserKey);
};

const hasUserInCallRoom = (callId, userId) => {
  const sockets = callRooms.get(callId);
  if (!sockets) return false;

  for (const socket of sockets) {
    if (socket.userId === userId) {
      return true;
    }
  }

  return false;
};

const rememberEndedCallEvent = ({ callId, userId, callerId = null, recipientId = null }) => {
  if (!callId || !userId) return;

  const existingEvent = endedCallEvents.get(callId);
  if (existingEvent?.timeoutId) {
    clearTimeout(existingEvent.timeoutId);
  }

  const timeoutId = setTimeout(() => {
    endedCallEvents.delete(callId);
  }, ENDED_CALL_EVENT_TTL_MS);

  endedCallEvents.set(callId, {
    callerId,
    recipientId,
    timeoutId,
    userId,
  });
};

const getOtherCallParticipantId = (callEvent, userId) => {
  if (!callEvent || !userId) return null;
  if (callEvent.callerId === userId) return callEvent.recipientId;
  if (callEvent.recipientId === userId) return callEvent.callerId;
  return null;
};

const broadcastPeerLeft = ({ callId, userId, callerId = null, recipientId = null, senderSocket = null }) => {
  const payload = {
    type: "peer_left",
    callId,
    userId,
  };

  rememberEndedCallEvent({ callId, userId, callerId, recipientId });
  broadcastToCallRoom(callId, senderSocket, payload);

  const otherParticipantId =
    userId === callerId ? recipientId : userId === recipientId ? callerId : null;

  if (otherParticipantId) {
    broadcastToUser(otherParticipantId, payload);
  }
};

const replacePresenceSubscriptions = (socket, userIds) => {
  for (const userId of socket.subscriptions.presenceUsers) {
    removeFromSetMap(presenceSubscribers, userId, socket);
  }

  socket.subscriptions.presenceUsers.clear();

  for (const userId of userIds) {
    if (!userId || userId === socket.userId) continue;
    socket.subscriptions.presenceUsers.add(userId);
    joinSetMap(presenceSubscribers, userId, socket);
  }
};

const sendJson = (socket, payload) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
};

const broadcastToUser = (userId, payload) => {
  const sockets = socketsByUserId.get(userId);
  if (!sockets) return 0;

  let deliveredCount = 0;
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
      deliveredCount += 1;
    }
  }

  return deliveredCount;
};

const broadcastToConversation = (conversationId, payload) => {
  const sockets = conversationSubscribers.get(conversationId);
  if (!sockets) return;

  for (const socket of sockets) {
    sendJson(socket, payload);
  }
};

const broadcastToCallRoom = (callId, senderSocket, payload) => {
  const sockets = callRooms.get(callId);
  if (!sockets) return;

  for (const socket of sockets) {
    if (socket !== senderSocket) {
      sendJson(socket, payload);
    }
  }
};

const broadcastPresenceUpdate = (userId, isOnline) => {
  const sockets = presenceSubscribers.get(userId);
  if (!sockets) return;

  for (const socket of sockets) {
    sendJson(socket, {
      type: "presence_updated",
      userId,
      isOnline,
    });
  }
};

const clearPendingCallInvite = (callId) => {
  const pendingInvite = pendingCallInvites.get(callId);
  if (!pendingInvite) return null;

  clearTimeout(pendingInvite.timeoutId);
  pendingCallInvites.delete(callId);
  return pendingInvite;
};

const formatCallDuration = (durationSeconds = 0) => {
  const safeDuration = Math.max(0, Number(durationSeconds) || 0);
  const minutes = Math.floor(safeDuration / 60);
  const seconds = safeDuration % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const createCallEventMetadata = (callId, status, extra = {}) => ({
  callEvent: {
    callId,
    status,
    kind: "video",
    ...extra,
  },
});

const createCallSystemMessage = async ({ callId, callerId, recipientId, text, status, metadata = {} }) => {
  const savedMessage = await query(
    `
      INSERT INTO messages (id, conversation_id, sender_id, recipient_id, text, message_type, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING id, conversation_id, sender_id, recipient_id, text, message_type, metadata, created_at
    `,
    [
      randomUUID(),
      getConversationId(callerId, recipientId),
      callerId,
      recipientId,
      text,
      "system",
      JSON.stringify(createCallEventMetadata(callId, status, metadata)),
    ]
  );

  broadcastToConversation(savedMessage.rows[0].conversation_id, {
    type: "chat_message",
    message: serializeMessage(savedMessage.rows[0]),
  });
};

const createMissedCallMessage = async ({ callId, callerId, recipientId }) =>
  createCallSystemMessage({
    callId,
    callerId,
    recipientId,
    text: "Missed video call",
    status: "missed",
  });

const createCallEndedMessage = async ({ callId, callerId, recipientId, durationSeconds }) =>
  createCallSystemMessage({
    callId,
    callerId,
    recipientId,
    text: `Video call - ${formatCallDuration(durationSeconds)}`,
    status: "ended",
    metadata: {
      durationSeconds,
      durationLabel: formatCallDuration(durationSeconds),
    },
  });

const endActiveCallSession = async (callId) => {
  const activeCall = activeCallSessions.get(callId);
  if (!activeCall || activeCall.ended) return null;

  activeCall.ended = true;
  activeCallSessions.delete(callId);

  const startTime = activeCall.startedAt || activeCall.acceptedAt || Date.now();
  const durationSeconds = Math.max(0, Math.round((Date.now() - startTime) / 1000));

  await createCallEndedMessage({
    callId,
    callerId: activeCall.callerId,
    recipientId: activeCall.recipientId,
    durationSeconds,
  });

  return { ...activeCall, durationSeconds };
};

const scheduleCallInviteTimeout = ({ callId, callerId, recipientId }) => {
  const timeoutId = setTimeout(async () => {
    const clearedInvite = clearPendingCallInvite(callId);
    if (!clearedInvite) return;

    try {
      await createMissedCallMessage({ callId, callerId, recipientId });
    } catch (error) {
      console.error("Failed to save missed call message", error);
    }

    const timeoutPayload = {
      type: "call_invite_timeout",
      callId,
      callerId,
      recipientId,
    };

    broadcastToUser(callerId, timeoutPayload);
    broadcastToUser(recipientId, timeoutPayload);
  }, CALL_INVITE_TIMEOUT_MS);

  pendingCallInvites.set(callId, {
    callerId,
    recipientId,
    timeoutId,
  });
};

const scheduleCallSocketLeave = ({ callId, userId }) => {
  if (!callId || !userId) return;

  clearScheduledCallLeave(callId, userId);

  const callUserKey = getCallUserKey(callId, userId);
  const leaveTimer = setTimeout(async () => {
    callLeaveTimers.delete(callUserKey);

    if (hasUserInCallRoom(callId, userId)) return;

    const activeCall = activeCallSessions.get(callId);

    try {
      await endActiveCallSession(callId);
    } catch (error) {
      console.error("Failed to save ended call message after socket close", error);
    }

    broadcastPeerLeft({
      callId,
      userId,
      callerId: activeCall?.callerId || null,
      recipientId: activeCall?.recipientId || null,
    });
  }, CALL_LEAVE_GRACE_MS);

  callLeaveTimers.set(callUserKey, leaveTimer);
};

const markConversationRead = async ({ conversationId, userId }) => {
  const readResult = await query(
    `
      INSERT INTO conversation_reads (user_id, conversation_id, last_read_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id, conversation_id)
      DO UPDATE SET last_read_at = EXCLUDED.last_read_at
      RETURNING last_read_at
    `,
    [userId, conversationId]
  );

  return readResult.rows[0]?.last_read_at || new Date().toISOString();
};

const handleJoinConversation = async (socket, payload) => {
  if (!socket.userId || !payload.conversationId) return;

  const lastReadAt = await markConversationRead({
    conversationId: payload.conversationId,
    userId: socket.userId,
  });

  socket.subscriptions.conversations.add(payload.conversationId);
  joinSetMap(conversationSubscribers, payload.conversationId, socket);
  sendJson(socket, { type: "joined_conversation", conversationId: payload.conversationId });
  broadcastToConversation(payload.conversationId, {
    type: "conversation_read",
    conversationId: payload.conversationId,
    userId: socket.userId,
    lastReadAt,
  });
};

const handleSubscribePresence = (socket, payload) => {
  if (!socket.userId) return;

  const requestedUserIds = Array.isArray(payload.userIds)
    ? [...new Set(payload.userIds.filter((userId) => typeof userId === "string"))]
    : [];

  replacePresenceSubscriptions(socket, requestedUserIds);

  sendJson(socket, {
    type: "presence_snapshot",
    onlineUserIds: requestedUserIds.filter((userId) => socketsByUserId.has(userId)),
  });
};

const handleMarkConversationRead = async (socket, payload) => {
  if (!socket.userId || !payload.conversationId) return;

  const lastReadAt = await markConversationRead({
    conversationId: payload.conversationId,
    userId: socket.userId,
  });

  broadcastToConversation(payload.conversationId, {
    type: "conversation_read",
    conversationId: payload.conversationId,
    userId: socket.userId,
    lastReadAt,
  });
};

const handleTypingState = (socket, payload) => {
  if (!socket.userId || !payload.conversationId) return;

  broadcastToConversation(payload.conversationId, {
    type: payload.type,
    conversationId: payload.conversationId,
    userId: socket.userId,
  });
};

const handleChatMessage = async (socket, payload) => {
  const normalizedText = payload.text?.trim() || "";
  const metadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
  const hasAttachments = Array.isArray(metadata.attachments) && metadata.attachments.length > 0;

  if (!socket.userId || !payload.recipientId || (!normalizedText && !hasAttachments)) return;

  const conversationId = getConversationId(socket.userId, payload.recipientId);
  const messageType = hasAttachments ? "attachment" : "text";
  const savedMessage = await query(
    `
      INSERT INTO messages (id, conversation_id, sender_id, recipient_id, text, message_type, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING id, conversation_id, sender_id, recipient_id, text, message_type, metadata, created_at
    `,
    [
      randomUUID(),
      conversationId,
      socket.userId,
      payload.recipientId,
      normalizedText,
      messageType,
      JSON.stringify(metadata),
    ]
  );

  broadcastToConversation(conversationId, {
    type: "chat_message",
    message: serializeMessage(savedMessage.rows[0]),
  });
};

const handleCallInvite = (socket, payload) => {
  if (!socket.userId || !payload.recipientId || !payload.callId) return;

  const deliveredCount = broadcastToUser(payload.recipientId, {
    type: "incoming_call_invite",
    callId: payload.callId,
    fromUserId: socket.userId,
    fromUserName: socket.user?.fullName || "Someone",
    fromUserProfilePic: socket.user?.profilePic || "/default-avatar.svg",
    createdAt: new Date().toISOString(),
  });

  clearPendingCallInvite(payload.callId);
  scheduleCallInviteTimeout({
    callId: payload.callId,
    callerId: socket.userId,
    recipientId: payload.recipientId,
  });

  if (deliveredCount === 0) {
    sendJson(socket, {
      type: "call_invite_pending_offline",
      callId: payload.callId,
      recipientId: payload.recipientId,
    });
  }
};

const handleCallInviteResponse = async (socket, payload) => {
  if (!socket.userId || !payload.callId || !payload.recipientId) return;

  const pendingInvite = clearPendingCallInvite(payload.callId);

  if (payload.accepted) {
    const callerId = pendingInvite?.callerId || payload.recipientId;
    const recipientId = pendingInvite?.recipientId || socket.userId;

    try {
      activeCallSessions.set(payload.callId, {
        callerId,
        recipientId,
        acceptedAt: Date.now(),
        startedAt: null,
        ended: false,
      });
    } catch (error) {
      console.error("Failed to track active call session", error);
    }
  } else if (payload.reason === "declined") {
    const callerId = pendingInvite?.callerId || payload.recipientId;
    const recipientId = pendingInvite?.recipientId || socket.userId;

    try {
      await createMissedCallMessage({ callId: payload.callId, callerId, recipientId });
    } catch (error) {
      console.error("Failed to save declined call message", error);
    }
  }

  broadcastToUser(payload.recipientId, {
    type: "call_invite_response",
    callId: payload.callId,
    accepted: Boolean(payload.accepted),
    recipientId: socket.userId,
    responderName: socket.user?.fullName || "Someone",
    reason: payload.reason || null,
  });
};

const handleJoinCall = (socket, payload) => {
  if (!socket.userId || !payload.callId) return;

  const endedCallEvent = endedCallEvents.get(payload.callId);
  const endedByOtherParticipant = getOtherCallParticipantId(endedCallEvent, socket.userId);

  if (endedByOtherParticipant) {
    sendJson(socket, {
      type: "peer_left",
      callId: payload.callId,
      userId: endedCallEvent.userId,
    });
    return;
  }

  clearScheduledCallLeave(payload.callId, socket.userId);
  socket.subscriptions.calls.add(payload.callId);
  joinSetMap(callRooms, payload.callId, socket);
  broadcastToCallRoom(payload.callId, socket, {
    type: "peer_joined",
    callId: payload.callId,
    userId: socket.userId,
  });
};

const handleCallSignal = (socket, payload) => {
  if (!socket.userId || !payload.callId || !payload.signal) return;

  broadcastToCallRoom(payload.callId, socket, {
    type: "call_signal",
    callId: payload.callId,
    userId: socket.userId,
    signal: payload.signal,
  });
};

const handleCallConnected = (socket, payload) => {
  if (!socket.userId || !payload.callId) return;

  const activeCall = activeCallSessions.get(payload.callId);
  if (activeCall && !activeCall.startedAt) {
    activeCall.startedAt = Date.now();
  }
};

const handleLeaveCall = async (socket, payload) => {
  if (!payload.callId) return;

  const pendingInvite = pendingCallInvites.get(payload.callId);
  const activeCall = activeCallSessions.get(payload.callId);
  clearScheduledCallLeave(payload.callId, socket.userId);

  if (pendingInvite && socket.userId === pendingInvite.callerId) {
    clearPendingCallInvite(payload.callId);
    try {
      await createMissedCallMessage({
        callId: payload.callId,
        callerId: pendingInvite.callerId,
        recipientId: pendingInvite.recipientId,
      });
    } catch (error) {
      console.error("Failed to save missed call message after caller ended call", error);
    }
    broadcastToUser(pendingInvite.recipientId, {
      type: "call_invite_cancelled",
      callId: payload.callId,
      callerId: pendingInvite.callerId,
      recipientId: pendingInvite.recipientId,
    });
  }

  try {
    await endActiveCallSession(payload.callId);
  } catch (error) {
    console.error("Failed to save ended call message", error);
  }

  removeFromSetMap(callRooms, payload.callId, socket);
  socket.subscriptions.calls.delete(payload.callId);
  broadcastPeerLeft({
    callId: payload.callId,
    userId: socket.userId,
    callerId: activeCall?.callerId || pendingInvite?.callerId || null,
    recipientId: activeCall?.recipientId || pendingInvite?.recipientId || null,
    senderSocket: socket,
  });
};

const websocketMessageHandlers = {
  call_connected: handleCallConnected,
  call_invite: handleCallInvite,
  call_invite_response: handleCallInviteResponse,
  call_signal: handleCallSignal,
  chat_message: handleChatMessage,
  join_call: handleJoinCall,
  join_conversation: handleJoinConversation,
  leave_call: handleLeaveCall,
  mark_conversation_read: handleMarkConversationRead,
  subscribe_presence: handleSubscribePresence,
  typing_start: handleTypingState,
  typing_stop: handleTypingState,
};

const handleWebSocketMessage = async (socket, rawData) => {
  try {
    const payload = JSON.parse(rawData.toString());
    const handler = websocketMessageHandlers[payload.type];

    if (!handler) {
      sendJson(socket, { type: "error", message: "Unsupported websocket message type" });
      return;
    }

    await handler(socket, payload);
  } catch (error) {
    console.error("WebSocket message error", error);
    sendJson(socket, { type: "error", message: "Invalid websocket payload" });
  }
};

const handleWebSocketClose = (socket) => {
  const wasLastSocketForUser =
    socket.userId && socketsByUserId.get(socket.userId)?.size === 1;

  if (socket.userId) {
    removeSocketForUser(socket.userId, socket);
  }

  for (const conversationId of socket.subscriptions.conversations) {
    removeFromSetMap(conversationSubscribers, conversationId, socket);
  }

  for (const callId of socket.subscriptions.calls) {
    removeFromSetMap(callRooms, callId, socket);
    scheduleCallSocketLeave({ callId, userId: socket.userId });
  }

  for (const presenceUserId of socket.subscriptions.presenceUsers) {
    removeFromSetMap(presenceSubscribers, presenceUserId, socket);
  }

  if (socket.userId && wasLastSocketForUser) {
    broadcastPresenceUpdate(socket.userId, false);
  }
};

app.use(
  cors({
    // origin: CLIENT_URL,
    origin: true,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(backendRoot, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/ai", aiRoutes);
// app.use("/api", (req, res) => {res.send("hello")});

wss.on("connection", (socket) => {
  socket.subscriptions = {
    conversations: new Set(),
    calls: new Set(),
    presenceUsers: new Set(),
  };

  socket.on("message", (rawData) => handleWebSocketMessage(socket, rawData));
  socket.on("close", () => handleWebSocketClose(socket));
});

server.on("upgrade", async (request, socket, head) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const tokenFromQuery = requestUrl.searchParams.get("token");
    const cookies = parseCookies(request.headers.cookie);
    const authToken = tokenFromQuery || cookies.jwt;
    const decoded = tokenFromQuery ? verifyWebSocketToken(authToken) : verifyAuthToken(authToken);
    const user = await getUserById(decoded.userId);

    if (!user) {
      throw new Error("User not found");
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.userId = user._id;
      ws.user = user;
      addSocketForUser(user._id, ws);
      wss.emit("connection", ws, request);
      if (socketsByUserId.get(user._id)?.size === 1) {
        broadcastPresenceUpdate(user._id, true);
      }
    });
  } catch (error) {
    console.error("WebSocket upgrade failed", error.message);
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});

if (process.env.NODE_ENV === "production") {
  const frontendDistPath = path.join(projectRoot, "frontend", "dist");

  app.use(express.static(frontendDistPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
