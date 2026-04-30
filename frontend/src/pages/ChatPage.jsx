import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EllipsisVerticalIcon, ImagePlusIcon, SendHorizontalIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";

import CallButton from "../components/CallButton";
import ChatLoader from "../components/ChatLoader";
import AvatarImage from "../components/AvatarImage";
import useAuthUser from "../hooks/useAuthUser";
import {
  clearConversation,
  getChatToken,
  deleteMessage,
  getMessages,
  getUserFriends,
  hideMessageForMe,
  uploadChatAttachment,
} from "../lib/api";
import { getWebSocketUrl } from "../lib/realtime";

const ChatAttachment = ({ attachment }) => {
  if (!attachment?.url) return null;

  if (attachment.type === "image") {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer">
        <img
          src={attachment.url}
          alt={attachment.name || "Attachment"}
          className="mt-2 max-h-72 w-full rounded-xl object-cover"
        />
      </a>
    );
  }

  if (attachment.type === "video") {
    return <video src={attachment.url} controls className="mt-2 max-h-72 w-full rounded-xl" />;
  }

  if (attachment.type === "audio") {
    return <audio src={attachment.url} controls className="mt-2 w-full" />;
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-current/20 px-3 py-2 text-sm"
    >
      <span className="truncate">{attachment.name || "Download file"}</span>
      <span className="opacity-70">Open</span>
    </a>
  );
};

const MessageActions = ({ canDeleteForEveryone, message, onDeleteForEveryone, onDeleteForMe }) => {
  const handleCopy = async () => {
    const textToCopy = message.text || message.metadata?.attachments?.[0]?.url;
    if (!textToCopy) {
      toast.error("Nothing to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success("Message copied");
    } catch (error) {
      toast.error("Could not copy message");
    }
  };

  return (
    <div className="dropdown dropdown-end">
      <button tabIndex={0} className="btn btn-ghost btn-circle btn-xs">
        <EllipsisVerticalIcon className="size-4" />
      </button>
      <ul
        tabIndex={0}
        className="dropdown-content z-20 mt-2 w-44 rounded-box bg-base-200 p-2 shadow-lg"
      >
        <li>
          <button type="button" className="btn btn-ghost btn-sm justify-start" onClick={handleCopy}>
            Copy
          </button>
        </li>
        <li>
          <button
            type="button"
            className="btn btn-ghost btn-sm justify-start"
            onClick={() => onDeleteForMe(message._id)}
          >
            Delete for me
          </button>
        </li>
        {canDeleteForEveryone ? (
          <li>
            <button
              type="button"
              className="btn btn-ghost btn-sm justify-start text-error"
              onClick={() => onDeleteForEveryone(message._id)}
            >
              Delete for everyone
            </button>
          </li>
        ) : null}
        <li>
          <button type="button" className="btn btn-ghost btn-sm justify-start" disabled>
            More soon
          </button>
        </li>
      </ul>
    </div>
  );
};

const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [socketReady, setSocketReady] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();

  const conversationId = useMemo(() => {
    if (!authUser?._id || !targetUserId) return null;
    return [authUser._id, targetUserId].sort().join(":");
  }, [authUser?._id, targetUserId]);

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
    enabled: !!authUser,
  });

  const { data: tokenData } = useQuery({
    queryKey: ["chatToken"],
    queryFn: getChatToken,
    enabled: !!authUser,
  });

  const { data: history = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["messages", targetUserId],
    queryFn: () => getMessages(targetUserId),
    enabled: !!authUser && !!targetUserId,
  });

  const targetUser = friends.find((friend) => friend._id === targetUserId);

  const { mutate: deleteMessageMutation } = useMutation({
    mutationFn: deleteMessage,
    onSuccess: (data) => {
      setMessages((currentMessages) =>
        currentMessages.filter((message) => message._id !== data.deletedMessageId)
      );
      toast.success("Message deleted");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not delete message");
    },
  });

  const { mutate: hideMessageMutation } = useMutation({
    mutationFn: hideMessageForMe,
    onSuccess: (data) => {
      setMessages((currentMessages) =>
        currentMessages.filter((message) => message._id !== data.hiddenMessageId)
      );
      toast.success("Message removed from your chat");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not hide message");
    },
  });

  const { mutate: clearConversationMutation, isPending: isClearingConversation } = useMutation({
    mutationFn: () => clearConversation(targetUserId),
    onSuccess: () => {
      setMessages([]);
      toast.success("Chat cleared for you");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not clear chat");
    },
  });

  useEffect(() => {
    setMessages(history);
  }, [history]);

  useEffect(() => {
    if (!tokenData?.token || !conversationId) return;

    let isCleaningUp = false;
    let hasOpened = false;
    const socket = new WebSocket(getWebSocketUrl(tokenData.token));
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      hasOpened = true;
      setSocketReady(true);
      socket.send(
        JSON.stringify({
          type: "join_conversation",
          conversationId,
        })
      );
    });

    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);

      if (payload.type === "chat_message" && payload.message.conversationId === conversationId) {
        setMessages((currentMessages) => {
          if (currentMessages.some((message) => message._id === payload.message._id)) {
            return currentMessages;
          }

          return [...currentMessages, payload.message];
        });
        queryClient.invalidateQueries({ queryKey: ["friends"] });
      }

      if (payload.type === "error") {
        toast.error(payload.message);
      }
    });

    socket.addEventListener("close", () => {
      setSocketReady(false);

      if (!isCleaningUp && !hasOpened) {
        toast.error("Could not connect to chat.");
      }
    });

    socket.addEventListener("error", () => {
      if (!isCleaningUp && !hasOpened) {
        console.error("Chat WebSocket connection failed");
      }
    });

    return () => {
      isCleaningUp = true;
      socket.close();
    };
  }, [conversationId, tokenData?.token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleAttachmentSelect = async (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setIsUploadingAttachment(true);

    try {
      const response = await uploadChatAttachment(selectedFile);
      setPendingAttachment(response.attachment);
      toast.success("Attachment uploaded");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not upload attachment");
    } finally {
      setIsUploadingAttachment(false);
      event.target.value = "";
    }
  };

  const handleSendMessage = (event) => {
    event.preventDefault();

    if (!socketReady || !socketRef.current) return;

    const trimmedText = messageText.trim();
    if (!trimmedText && !pendingAttachment) return;

    socketRef.current.send(
      JSON.stringify({
        type: "chat_message",
        recipientId: targetUserId,
        text: trimmedText,
        metadata: pendingAttachment ? { attachments: [pendingAttachment] } : {},
      })
    );

    setMessageText("");
    setPendingAttachment(null);
    queryClient.invalidateQueries({ queryKey: ["friends"] });
  };

  const handleVideoCall = () => {
    if (!socketReady || !socketRef.current) {
      toast.error("Chat connection is still loading");
      return;
    }

    const callId = crypto.randomUUID();
    const callUrl = `${window.location.origin}/call/${callId}`;

    socketRef.current.send(
      JSON.stringify({
        type: "chat_message",
        recipientId: targetUserId,
        text: `I've started a video call. Join me here: ${callUrl}`,
      })
    );

    toast.success("Video call invite sent");
    navigate(`/call/${callId}`);
  };

  if (loadingFriends || loadingMessages || !authUser || !conversationId) {
    return <ChatLoader />;
  }

  return (
    <div className="h-[93vh] flex flex-col bg-base-100">
      <div className="border-b border-base-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0 flex items-center gap-3">
            <div className="avatar">
              <div className="w-12 rounded-full">
                <AvatarImage
                  src={targetUser?.profilePic}
                  name={targetUser?.fullName}
                  alt={targetUser?.fullName || "Friend"}
                />
              </div>
            </div>
            <div>
              <h1 className="font-semibold text-lg">{targetUser?.fullName || "Conversation"}</h1>
              <p className="text-sm opacity-70">
                {socketReady ? "Connected over WebSocket" : "Connecting..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={isClearingConversation}
              onClick={() => {
                if (window.confirm("Clear this chat for your account?")) {
                  clearConversationMutation();
                }
              }}
            >
              {isClearingConversation ? "Clearing..." : "Clear chat"}
            </button>
            <CallButton handleVideoCall={handleVideoCall} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-4xl mx-auto space-y-3">
          {messages.map((message) => {
            const isOwnMessage = message.senderId === authUser._id;
            const attachment = message.metadata?.attachments?.[0];

            return (
              <div
                key={message._id}
                className={`flex items-start gap-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}
              >
                {!isOwnMessage ? (
                  <MessageActions
                    canDeleteForEveryone={false}
                    message={message}
                    onDeleteForEveryone={deleteMessageMutation}
                    onDeleteForMe={hideMessageMutation}
                  />
                ) : null}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                    isOwnMessage ? "bg-primary text-primary-content" : "bg-base-200"
                  }`}
                >
                  {message.text ? (
                    <p className="whitespace-pre-wrap break-words">{message.text}</p>
                  ) : null}
                  {attachment ? <ChatAttachment attachment={attachment} /> : null}
                  <p className="mt-2 text-[11px] opacity-70">
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {isOwnMessage ? (
                  <MessageActions
                    canDeleteForEveryone={true}
                    message={message}
                    onDeleteForEveryone={deleteMessageMutation}
                    onDeleteForMe={hideMessageMutation}
                  />
                ) : null}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form onSubmit={handleSendMessage} className="border-t border-base-300 px-4 py-4">
        <div className="max-w-4xl mx-auto space-y-3">
          {pendingAttachment ? (
            <div className="flex items-center justify-between rounded-2xl bg-base-200 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{pendingAttachment.name}</p>
                <p className="text-sm opacity-70">{pendingAttachment.mimeType}</p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-circle btn-sm"
                onClick={() => setPendingAttachment(null)}
              >
                <XIcon className="size-4" />
              </button>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleAttachmentSelect}
            />
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAttachment}
            >
              <ImagePlusIcon className="size-4" />
              {isUploadingAttachment ? "Uploading..." : "Attach"}
            </button>

            <input
              type="text"
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              placeholder="Type a message..."
              className="input input-bordered flex-1"
            />

            <button
              className="btn btn-primary"
              type="submit"
              disabled={!socketReady || (!messageText.trim() && !pendingAttachment)}
            >
              <SendHorizontalIcon className="size-4" />
              Send
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ChatPage;
