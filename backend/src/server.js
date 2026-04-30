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

const socketsByUserId = new Map();
const conversationSubscribers = new Map();
const callRooms = new Map();

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

const sendJson = (socket, payload) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
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

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(backendRoot, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);

wss.on("connection", (socket) => {
  socket.subscriptions = {
    conversations: new Set(),
    calls: new Set(),
  };

  socket.on("message", async (rawData) => {
    try {
      const payload = JSON.parse(rawData.toString());

      switch (payload.type) {
        case "join_conversation": {
          if (!socket.userId || !payload.conversationId) return;
          await query(
            `
              INSERT INTO conversation_reads (user_id, conversation_id, last_read_at)
              VALUES ($1, $2, NOW())
              ON CONFLICT (user_id, conversation_id)
              DO UPDATE SET last_read_at = EXCLUDED.last_read_at
            `,
            [socket.userId, payload.conversationId]
          );
          socket.subscriptions.conversations.add(payload.conversationId);
          joinSetMap(conversationSubscribers, payload.conversationId, socket);
          sendJson(socket, { type: "joined_conversation", conversationId: payload.conversationId });
          break;
        }

        case "chat_message": {
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
          break;
        }

        case "join_call": {
          if (!socket.userId || !payload.callId) return;
          socket.subscriptions.calls.add(payload.callId);
          joinSetMap(callRooms, payload.callId, socket);
          broadcastToCallRoom(payload.callId, socket, {
            type: "peer_joined",
            callId: payload.callId,
            userId: socket.userId,
          });
          break;
        }

        case "call_signal": {
          if (!socket.userId || !payload.callId || !payload.signal) return;
          broadcastToCallRoom(payload.callId, socket, {
            type: "call_signal",
            callId: payload.callId,
            userId: socket.userId,
            signal: payload.signal,
          });
          break;
        }

        case "leave_call": {
          if (!payload.callId) return;
          removeFromSetMap(callRooms, payload.callId, socket);
          socket.subscriptions.calls.delete(payload.callId);
          broadcastToCallRoom(payload.callId, socket, {
            type: "peer_left",
            callId: payload.callId,
            userId: socket.userId,
          });
          break;
        }

        default:
          sendJson(socket, { type: "error", message: "Unsupported websocket message type" });
      }
    } catch (error) {
      console.error("WebSocket message error", error);
      sendJson(socket, { type: "error", message: "Invalid websocket payload" });
    }
  });

  socket.on("close", () => {
    if (socket.userId) {
      removeSocketForUser(socket.userId, socket);
    }

    for (const conversationId of socket.subscriptions.conversations) {
      removeFromSetMap(conversationSubscribers, conversationId, socket);
    }

    for (const callId of socket.subscriptions.calls) {
      removeFromSetMap(callRooms, callId, socket);
      broadcastToCallRoom(callId, socket, {
        type: "peer_left",
        callId,
        userId: socket.userId,
      });
    }
  });
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
      addSocketForUser(user._id, ws);
      wss.emit("connection", ws, request);
    });
  } catch (error) {
    console.error("WebSocket upgrade failed", error.message);
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
