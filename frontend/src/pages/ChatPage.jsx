import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownIcon, ImagePlusIcon, MessageSquareTextIcon, VideoIcon } from "lucide-react";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";

import AIDetectionModal from "../components/AIDetectionModal";
import AvatarImage from "../components/AvatarImage";
import ChatLoader from "../components/ChatLoader";
import ChatHeader from "../components/chat/ChatHeader";
import ChatMessageItem from "../components/chat/ChatMessageItem";
import MessageComposer from "../components/chat/MessageComposer";
import TypingIndicator from "../components/chat/TypingIndicator";
import useAuthUser from "../hooks/useAuthUser";
import {
  clearConversation,
  describeImageMessage,
  deleteMessage,
  detectImageMessage,
  detectLinkMessage,
  detectTextMessage,
  getChatToken,
  getMessages,
  getUserFriends,
  hideMessageForMe,
  removeFriend,
  summarizeMessage,
  translateMessageToEnglish,
  uploadChatAttachment,
} from "../lib/api";
import { getWebSocketUrl } from "../lib/realtime";

const buildReplyPayload = (message) => ({
  messageId: message._id,
  senderId: message.senderId,
  text: message.text || "",
  attachment: message.metadata?.attachments?.length
    ? {
        name:
          message.metadata.attachments.length > 1
            ? `${message.metadata.attachments.length} attachments`
            : message.metadata.attachments[0].name,
        type:
          message.metadata.attachments.length > 1
            ? "file"
            : message.metadata.attachments[0].type,
      }
    : null,
});

const getLatestReadAt = (messageHistory) => {
  let latestReadAt = null;

  for (const message of messageHistory) {
    if (!message.readAt) continue;
    if (!latestReadAt || new Date(message.readAt).getTime() > new Date(latestReadAt).getTime()) {
      latestReadAt = message.readAt;
    }
  }

  return latestReadAt;
};

const getAttachmentTypeFromFile = (file) => {
  const mimeType = file.type || "application/octet-stream";

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";

  return "file";
};

const createPendingAttachment = (file) => {
  const type = getAttachmentTypeFromFile(file);

  return {
    id: uuidv4(),
    file,
    name: file.name || "Pasted attachment",
    mimeType: file.type || "application/octet-stream",
    previewUrl: type === "image" ? URL.createObjectURL(file) : null,
    size: file.size,
    type,
  };
};

const revokePendingAttachmentPreview = (attachment) => {
  if (attachment?.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
};

const getMessageDateKey = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "unknown";

  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const getMessageDateLabel = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (getMessageDateKey(timestamp) === getMessageDateKey(today)) return "Today";
  if (getMessageDateKey(timestamp) === getMessageDateKey(yesterday)) return "Yesterday";

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
};

const ChatDateSeparator = ({ timestamp }) => (
  <div className="flex items-center justify-center py-3">
    <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-base-content/50">
      <span className="h-px w-10 bg-base-content/10 sm:w-16" />
      <span className="rounded-full border border-base-content/10 bg-base-100/90 px-3 py-1 shadow-sm backdrop-blur">
        {getMessageDateLabel(timestamp)}
      </span>
      <span className="h-px w-10 bg-base-content/10 sm:w-16" />
    </div>
  </div>
);

const NewMessagesSeparator = () => (
  <div className="flex items-center justify-center py-3">
    <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-primary">
      <span className="h-px w-12 bg-primary/30 sm:w-20" />
      <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 shadow-sm backdrop-blur">
        New messages
      </span>
      <span className="h-px w-12 bg-primary/30 sm:w-20" />
    </div>
  </div>
);

const ChatEmptyState = ({ isOnline, onAttachFile, onSayHi, onStartCall, targetUser }) => (
  <div className="flex min-h-[calc(100vh-18rem)] items-center justify-center px-2 py-10">
    <div className="flex w-full max-w-lg flex-col items-center text-center">
      <div className="avatar">
        <div className="w-20 rounded-full ring ring-base-300 ring-offset-4 ring-offset-base-100 sm:w-24">
          <AvatarImage
            src={targetUser?.profilePic}
            name={targetUser?.fullName}
            alt={targetUser?.fullName || "Friend"}
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-xl font-semibold sm:text-2xl">
            {targetUser?.fullName || "This conversation"}
          </h2>
          <span className={`size-2.5 rounded-full ${isOnline ? "bg-success" : "bg-base-content/30"}`} />
        </div>
        <p className="mx-auto max-w-sm text-sm leading-6 opacity-70 sm:text-base">
          Start a secure conversation with {targetUser?.fullName || "your friend"}.
        </p>
      </div>

      <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <button type="button" className="btn btn-primary sm:min-w-28" onClick={onSayHi}>
          <MessageSquareTextIcon className="size-4" />
          Say hi
        </button>
        <button type="button" className="btn btn-outline sm:min-w-28" onClick={onAttachFile}>
          <ImagePlusIcon className="size-4" />
          Attach
        </button>
        <button type="button" className="btn btn-ghost sm:min-w-28" onClick={onStartCall}>
          <VideoIcon className="size-4" />
          Call
        </button>
      </div>
    </div>
  </div>
);

const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);
  const chatScrollRef = useRef(null);
  const messageNodesRef = useRef({});
  const pendingAttachmentsRef = useRef([]);
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const isAwayFromBottomRef = useRef(false);

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [socketReady, setSocketReady] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [aiDetectionResult, setAiDetectionResult] = useState(null);
  const [detectingMessageId, setDetectingMessageId] = useState(null);
  const [checkingLinkMessageId, setCheckingLinkMessageId] = useState(null);
  const [summarizingMessageId, setSummarizingMessageId] = useState(null);
  const [describingImageMessageId, setDescribingImageMessageId] = useState(null);
  const [isRecheckingDetection, setIsRecheckingDetection] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [typingUserId, setTypingUserId] = useState(null);
  const [targetUserReadAt, setTargetUserReadAt] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [isTargetUserOnline, setIsTargetUserOnline] = useState(false);
  const [translatedMessages, setTranslatedMessages] = useState({});
  const [translatingMessageId, setTranslatingMessageId] = useState(null);
  const [aiMessageStatuses, setAiMessageStatuses] = useState({});
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [newIncomingMessageCount, setNewIncomingMessageCount] = useState(0);
  const [firstNewMessageId, setFirstNewMessageId] = useState(null);
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState(0);

  const { authUser } = useAuthUser();

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
  const normalizedMessageSearch = messageSearch.trim().toLowerCase();

  const matchingMessageIds = useMemo(() => {
    if (!normalizedMessageSearch) return [];

    return messages
      .filter((message) => message.text?.toLowerCase().includes(normalizedMessageSearch))
      .map((message) => message._id)
      .reverse();
  }, [messages, normalizedMessageSearch]);

  const matchingMessageCount = matchingMessageIds.length;
  const activeSearchMessageId = matchingMessageIds[activeSearchMatchIndex] || null;

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

  const { mutate: removeFriendMutation, isPending: isRemovingFriend } = useMutation({
    mutationFn: removeFriend,
    onSuccess: () => {
      toast.success(`${targetUser?.fullName || "Friend"} removed from your friend list`);
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] });
      navigate("/friends");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not remove friend");
    },
  });

  const { mutateAsync: detectImageMutation } = useMutation({
    mutationFn: ({ messageId, force }) => detectImageMessage(messageId, { force }),
  });

  const { mutateAsync: detectTextMutation } = useMutation({
    mutationFn: ({ messageId, force }) => detectTextMessage(messageId, { force }),
  });

  const { mutateAsync: detectLinkMutation } = useMutation({
    mutationFn: ({ messageId, force }) => detectLinkMessage(messageId, { force }),
  });

  const { mutateAsync: translateMessageMutation } = useMutation({
    mutationFn: ({ messageId, force }) => translateMessageToEnglish(messageId, { force }),
  });

  const { mutateAsync: summarizeMessageMutation } = useMutation({
    mutationFn: ({ messageId, force }) => summarizeMessage(messageId, { force }),
  });

  const { mutateAsync: describeImageMessageMutation } = useMutation({
    mutationFn: ({ messageId, force }) => describeImageMessage(messageId, { force }),
  });

  useEffect(() => {
    setMessages(history);
    setTargetUserReadAt(getLatestReadAt(history));
    setTranslatedMessages({});
    setAiMessageStatuses({});
  }, [history]);

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => {
    return () => {
      pendingAttachmentsRef.current.forEach(revokePendingAttachmentPreview);
    };
  }, []);

  useEffect(() => {
    if (!tokenData?.token || !conversationId || !authUser?._id) return;

    let isCleaningUp = false;
    let hasOpened = false;
    const socket = new WebSocket(getWebSocketUrl(tokenData.token));
    socketRef.current = socket;

    const markConversationRead = () => {
      if (socket.readyState !== WebSocket.OPEN || !conversationId) return;

      socket.send(
        JSON.stringify({
          type: "mark_conversation_read",
          conversationId,
        })
      );
    };

    socket.addEventListener("open", () => {
      hasOpened = true;
      setSocketReady(true);
      socket.send(
        JSON.stringify({
          type: "join_conversation",
          conversationId,
        })
      );
      socket.send(
        JSON.stringify({
          type: "subscribe_presence",
          userIds: [targetUserId],
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

        if (payload.message.senderId === targetUserId) {
          setTypingUserId(null);
          if (isAwayFromBottomRef.current) {
            setFirstNewMessageId((currentMessageId) => currentMessageId || payload.message._id);
            setNewIncomingMessageCount((currentCount) => currentCount + 1);
          }
          if (document.visibilityState === "visible") {
            markConversationRead();
          }
        }
      }

      if (payload.type === "presence_snapshot") {
        setIsTargetUserOnline((payload.onlineUserIds || []).includes(targetUserId));
      }

      if (payload.type === "presence_updated" && payload.userId === targetUserId) {
        setIsTargetUserOnline(Boolean(payload.isOnline));
      }

      if (
        payload.type === "conversation_read" &&
        payload.conversationId === conversationId &&
        payload.userId === targetUserId
      ) {
        setTargetUserReadAt(payload.lastReadAt);
      }

      if (
        payload.type === "typing_start" &&
        payload.conversationId === conversationId &&
        payload.userId === targetUserId
      ) {
        setTypingUserId(payload.userId);
      }

      if (
        payload.type === "typing_stop" &&
        payload.conversationId === conversationId &&
        payload.userId === targetUserId
      ) {
        setTypingUserId(null);
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

    const handleVisibleRead = () => {
      if (document.visibilityState === "visible") {
        markConversationRead();
      }
    };

    document.addEventListener("visibilitychange", handleVisibleRead);
    window.addEventListener("focus", handleVisibleRead);

    return () => {
      isCleaningUp = true;
      document.removeEventListener("visibilitychange", handleVisibleRead);
      window.removeEventListener("focus", handleVisibleRead);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      socket.close();
    };
  }, [authUser?._id, conversationId, queryClient, targetUserId, tokenData?.token]);

  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    const shouldAutoScroll =
      !isAwayFromBottomRef.current || latestMessage?.senderId === authUser?._id;

    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      if (latestMessage?.senderId === authUser?._id) {
        setNewIncomingMessageCount(0);
        setFirstNewMessageId(null);
      }
    }
  }, [authUser?._id, messages, typingUserId]);

  const updateScrollToBottomVisibility = () => {
    const scrollElement = chatScrollRef.current;
    if (!scrollElement) return;

    const distanceFromBottom =
      scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
    const isAwayFromBottom = distanceFromBottom > 180;

    isAwayFromBottomRef.current = isAwayFromBottom;
    setShowScrollToBottom(isAwayFromBottom);

    if (!isAwayFromBottom) {
      setNewIncomingMessageCount(0);
      setFirstNewMessageId(null);
    }
  };

  useEffect(() => {
    window.requestAnimationFrame(updateScrollToBottomVisibility);
  }, [messages.length, typingUserId]);

  useEffect(() => {
    const canAutoFocusComposer =
      typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

    if (!canAutoFocusComposer || isSearchExpanded) return;

    const focusTimer = window.setTimeout(() => {
      messageInputRef.current?.focus({ preventScroll: true });
    }, 120);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [isSearchExpanded, targetUserId]);

  useEffect(() => {
    if (isSearchExpanded) return;
    setMessageSearch("");
    setActiveSearchMatchIndex(0);
  }, [isSearchExpanded]);

  useEffect(() => {
    if (!isSearchExpanded) return;

    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus({ preventScroll: true });
      searchInputRef.current?.select();
    }, 80);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [isSearchExpanded]);

  useEffect(() => {
    const isEditableElement = (element) => {
      if (!element) return false;
      const tagName = element.tagName?.toLowerCase();
      return (
        element.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      );
    };

    const focusComposerOnWideScreen = () => {
      if (typeof window === "undefined" || !window.matchMedia("(min-width: 768px)").matches) {
        return;
      }

      window.requestAnimationFrame(() => {
        messageInputRef.current?.focus({ preventScroll: true });
      });
    };

    const handleChatShortcut = (event) => {
      const key = event.key.toLowerCase();
      const isEditableTarget = isEditableElement(event.target);

      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        setIsSearchExpanded(true);
        return;
      }

      if (
        key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isEditableTarget
      ) {
        event.preventDefault();
        setIsSearchExpanded(true);
        return;
      }

      if (event.key === "Escape") {
        if (isSearchExpanded) {
          event.preventDefault();
          setIsSearchExpanded(false);
          focusComposerOnWideScreen();
          return;
        }

        if (replyingTo) {
          event.preventDefault();
          setReplyingTo(null);
          focusComposerOnWideScreen();
        }
      }
    };

    window.addEventListener("keydown", handleChatShortcut);

    return () => {
      window.removeEventListener("keydown", handleChatShortcut);
    };
  }, [isSearchExpanded, replyingTo]);

  useEffect(() => {
    setActiveSearchMatchIndex(0);
  }, [normalizedMessageSearch]);

  useEffect(() => {
    if (!matchingMessageCount) {
      setActiveSearchMatchIndex(0);
      return;
    }

    setActiveSearchMatchIndex((currentIndex) => {
      if (currentIndex < matchingMessageCount) {
        return currentIndex;
      }

      return matchingMessageCount - 1;
    });
  }, [matchingMessageCount]);

  useEffect(() => {
    if (!activeSearchMessageId) return;

    const targetNode = messageNodesRef.current[activeSearchMessageId];
    if (!targetNode) return;

    targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeSearchMessageId]);

  const lastMessageIdRef = useRef(null);

useEffect(() => {
  if (!socketReady || !conversationId || !authUser?._id) return;

  const latestMessage = messages[messages.length - 1];
  if (!latestMessage) return;

  // prevent infinite loop
  if (lastMessageIdRef.current === latestMessage._id) return;

  lastMessageIdRef.current = latestMessage._id;

  if (
    latestMessage.senderId === targetUserId &&
    document.visibilityState === "visible"
  ) {
    socketRef.current?.send(
      JSON.stringify({
        type: "mark_conversation_read",
        conversationId,
      })
    );
  }
}, [messages, socketReady, conversationId, authUser?._id, targetUserId]);

  const sendTypingState = (type) => {
    if (!socketReady || !socketRef.current || !conversationId) return;

    socketRef.current.send(
      JSON.stringify({
        type,
        conversationId,
      })
    );
  };

  const stopTyping = () => {
    if (!isTypingRef.current) return;

    isTypingRef.current = false;
    sendTypingState("typing_stop");

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const scheduleTypingStop = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1600);
  };

  const handleMessageTextChange = (event) => {
    const nextValue = event.target.value;
    setMessageText(nextValue);

    if (!nextValue.trim()) {
      stopTyping();
      return;
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTypingState("typing_start");
    }

    scheduleTypingStop();
  };

  const addPendingFiles = (files) => {
    if (!files.length) return;

    const nextAttachments = files.map(createPendingAttachment);
    setPendingAttachments((currentAttachments) => [...currentAttachments, ...nextAttachments]);

    toast.success(
      nextAttachments.length === 1
        ? "Attachment ready"
        : `${nextAttachments.length} attachments ready`
    );
    window.requestAnimationFrame(() => {
      messageInputRef.current?.focus();
    });
  };

  const handleAttachmentSelect = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;

    try {
      addPendingFiles(selectedFiles);
    } finally {
      event.target.value = "";
    }
  };

  const handleComposerPaste = async (event) => {
    const pastedFiles = Array.from(event.clipboardData?.files || []);
    if (!pastedFiles.length) return;

    event.preventDefault();
    addPendingFiles(pastedFiles);
  };

  const hasDraggedFiles = (event) => {
    return Array.from(event.dataTransfer?.types || []).includes("Files");
  };

  const handleChatDragEnter = (event) => {
    if (!hasDraggedFiles(event)) return;

    event.preventDefault();
    setIsDraggingFiles(true);
  };

  const handleChatDragOver = (event) => {
    if (!hasDraggedFiles(event)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingFiles(true);
  };

  const handleChatDragLeave = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDraggingFiles(false);
    }
  };

  const handleChatDrop = async (event) => {
    if (!hasDraggedFiles(event)) return;

    event.preventDefault();
    setIsDraggingFiles(false);

    const droppedFiles = Array.from(event.dataTransfer?.files || []);
    addPendingFiles(droppedFiles);
  };

  const handleRemovePendingAttachment = (attachmentIndex) => {
    setPendingAttachments((currentAttachments) => {
      const attachmentToRemove = currentAttachments[attachmentIndex];
      revokePendingAttachmentPreview(attachmentToRemove);
      return currentAttachments.filter((_, index) => index !== attachmentIndex);
    });
  };

  const handleClearPendingAttachments = () => {
    pendingAttachments.forEach(revokePendingAttachmentPreview);
    setPendingAttachments([]);
  };

  const handleSearchChange = (event) => {
    setMessageSearch(event.target.value);
  };

  const handleJumpToNextSearchMatch = () => {
    if (!matchingMessageCount) return;

    setActiveSearchMatchIndex((currentIndex) =>
      currentIndex === 0 ? matchingMessageCount - 1 : currentIndex - 1
    );
  };

  const handleJumpToPreviousSearchMatch = () => {
    if (!matchingMessageCount) return;

    setActiveSearchMatchIndex((currentIndex) => (currentIndex + 1) % matchingMessageCount);
  };

  const handleComposerKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();

    const trimmedText = messageText.trim();
    if (!trimmedText && pendingAttachments.length === 0) {
      return;
    }

    event.currentTarget.form?.requestSubmit();
  };

  const registerMessageNode = (messageId, node) => {
    if (node) {
      messageNodesRef.current[messageId] = node;
      return;
    }

    delete messageNodesRef.current[messageId];
  };

  const handleJumpToMessage = (messageId) => {
    const targetNode = messageNodesRef.current[messageId];
    if (!targetNode) {
      toast.error("Original message is not available in this chat");
      return;
    }

    targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);
    window.setTimeout(() => {
      setHighlightedMessageId((currentMessageId) =>
        currentMessageId === messageId ? null : currentMessageId
      );
    }, 1800);
  };

  const handleReplyToMessage = (currentMessage) => {
    setReplyingTo(buildReplyPayload(currentMessage));
    window.requestAnimationFrame(() => {
      messageInputRef.current?.focus();
    });
  };

  const scrollToLatestMessage = () => {
    setNewIncomingMessageCount(0);
    setFirstNewMessageId(null);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToFirstNewMessage = () => {
    if (!firstNewMessageId) {
      scrollToLatestMessage();
      return;
    }

    const targetNode = messageNodesRef.current[firstNewMessageId];
    if (!targetNode) {
      scrollToLatestMessage();
      return;
    }

    targetNode.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePrefillGreeting = () => {
    setMessageText((currentText) => currentText || `Hi ${targetUser?.fullName || "there"}!`);
    window.requestAnimationFrame(() => {
      messageInputRef.current?.focus({ preventScroll: true });
    });
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();

    if (!socketReady || !socketRef.current || isUploadingAttachment) return;

    const trimmedText = messageText.trim();
    if (!trimmedText && pendingAttachments.length === 0) return;

    let uploadedAttachments = [];

    if (pendingAttachments.length > 0) {
      setIsUploadingAttachment(true);

      try {
        for (const pendingAttachment of pendingAttachments) {
          if (!pendingAttachment.file) {
            uploadedAttachments.push(pendingAttachment);
            continue;
          }

          const response = await uploadChatAttachment(pendingAttachment.file);
          uploadedAttachments.push(response.attachment);
        }
      } catch (error) {
        toast.error(error?.response?.data?.message || "Could not upload attachment");
        return;
      } finally {
        setIsUploadingAttachment(false);
      }
    }

    const sendChatPayload = ({ text = "", attachment = null, includeReply = false }) => {
      const metadata = {};

      if (attachment) {
        metadata.attachments = [attachment];
      }

      if (includeReply && replyingTo) {
        metadata.replyTo = replyingTo;
      }

      socketRef.current.send(
        JSON.stringify({
          type: "chat_message",
          recipientId: targetUserId,
          text,
          metadata,
        })
      );
    };

    if (trimmedText) {
      sendChatPayload({ text: trimmedText, includeReply: true });
      uploadedAttachments.forEach((attachment) => {
        sendChatPayload({ attachment });
      });
    } else {
      uploadedAttachments.forEach((attachment, index) => {
        sendChatPayload({ attachment, includeReply: index === 0 });
      });
    }

    setMessageText("");
    pendingAttachments.forEach(revokePendingAttachmentPreview);
    setPendingAttachments([]);
    setReplyingTo(null);
    stopTyping();
    queryClient.invalidateQueries({ queryKey: ["friends"] });
  };

  const handleVideoCall = () => {
    if (!socketReady || !socketRef.current) {
      toast.error("Chat connection is still loading");
      return;
    }

    const callId = uuidv4();

    socketRef.current.send(
      JSON.stringify({
        type: "call_invite",
        callId,
        recipientId: targetUserId,
      })
    );

    const callParams = new URLSearchParams({
      mode: "outgoing",
      peer: targetUserId,
      peerName: targetUser?.fullName || "Friend",
      peerPic: targetUser?.profilePic || "/default-avatar.svg",
      returnTo: `/chat/${targetUserId}`,
    });

    toast.success(`Calling ${targetUser?.fullName || "your friend"}...`);
    navigate(`/call/${callId}?${callParams.toString()}`);
  };

  const setAiMessageStatus = (messageId, status) => {
    setAiMessageStatuses((currentStatuses) => ({
      ...currentStatuses,
      [messageId]: {
        updatedAt: new Date().toISOString(),
        ...status,
      },
    }));
  };

  const clearAiMessageStatus = (messageId) => {
    setAiMessageStatuses((currentStatuses) => {
      const nextStatuses = { ...currentStatuses };
      delete nextStatuses[messageId];
      return nextStatuses;
    });
  };

  const getAiErrorMessage = (error, fallbackMessage) =>
    error?.response?.data?.message || fallbackMessage;

  const runDetectionForMessage = async (message, { force = false } = {}) => {
    const attachment = message.metadata?.attachments?.[0];
    const text = message.text?.trim();

    if (attachment?.type === "image") {
      setDetectingMessageId(message._id);
      setAiMessageStatus(message._id, {
        type: "detect",
        state: "loading",
        label: "Scanning image",
        message: force ? "Refreshing image safety result..." : "Checking image safety signals...",
      });

      try {
        const result = await detectImageMutation({ messageId: message._id, force });
        setAiDetectionResult(result);
        setAiMessageStatus(message._id, {
          type: "detect",
          state: "success",
          label: result.cached && !force ? "Saved image result" : "Image check complete",
          message: result.analysis?.overall?.message || "Image safety report is ready.",
        });
        toast.success(
          force
            ? "AI image detection refreshed"
            : result.cached
              ? "Showing saved AI result"
              : "AI image detection complete"
        );
      } catch (error) {
        const messageText = getAiErrorMessage(error, "Could not run AI detection");
        setAiMessageStatus(message._id, {
          type: "detect",
          state: "error",
          label: "Image check failed",
          message: messageText,
        });
        toast.error(messageText);
      } finally {
        setDetectingMessageId(null);
      }
      return;
    }

    if (!text) {
      toast.error("AI detection currently supports image or text messages");
      return;
    }

    setDetectingMessageId(message._id);
    setAiMessageStatus(message._id, {
      type: "detect",
      state: "loading",
      label: "Scanning text",
      message: force ? "Refreshing text detection result..." : "Checking text safety signals...",
    });

    try {
      const result = await detectTextMutation({ messageId: message._id, force });
      setAiDetectionResult(result);
      setAiMessageStatus(message._id, {
        type: "detect",
        state: "success",
        label: result.cached && !force ? "Saved text result" : "Text check complete",
        message: result.analysis?.overall?.message || "Text detection report is ready.",
      });
      toast.success(
        force
          ? "AI text detection refreshed"
          : result.cached
            ? "Showing saved AI result"
            : "AI text detection complete"
      );
    } catch (error) {
      const messageText = getAiErrorMessage(error, "Could not run AI detection");
      setAiMessageStatus(message._id, {
        type: "detect",
        state: "error",
        label: "Text check failed",
        message: messageText,
      });
      toast.error(messageText);
    } finally {
      setDetectingMessageId(null);
    }
  };

  const runLinkCheckForMessage = async (message, { force = false } = {}) => {
    const text = message.text?.trim();

    if (!text || !/(https?:\/\/|www\.)/i.test(text)) {
      toast.error("Suspicious link check needs a message with at least one link");
      return;
    }

    setCheckingLinkMessageId(message._id);
    setAiMessageStatus(message._id, {
      type: "link",
      state: "loading",
      label: "Checking links",
      message: force ? "Refreshing link safety result..." : "Looking for suspicious link signals...",
    });

    try {
      const result = await detectLinkMutation({ messageId: message._id, force });
      setAiDetectionResult(result);
      setAiMessageStatus(message._id, {
        type: "link",
        state: "success",
        label: result.cached && !force ? "Saved link result" : "Link check complete",
        message: result.analysis?.overall?.message || "Link safety report is ready.",
      });
      toast.success(
        force
          ? "Suspicious link check refreshed"
          : result.cached
            ? "Showing saved link safety result"
            : "Suspicious link check complete"
      );
    } catch (error) {
      const messageText = getAiErrorMessage(error, "Could not check the link");
      setAiMessageStatus(message._id, {
        type: "link",
        state: "error",
        label: "Link check failed",
        message: messageText,
      });
      toast.error(messageText);
    } finally {
      setCheckingLinkMessageId(null);
    }
  };

  const handleTranslateMessage = async (message, { force = false } = {}) => {
    const text = message.text?.trim();
    if (!text) {
      toast.error("Translation only supports text messages");
      return;
    }

    setTranslatingMessageId(message._id);
    setAiMessageStatus(message._id, {
      type: "translate",
      state: "loading",
      label: "Translating",
      message: force ? "Refreshing English translation..." : "Detecting language and translating...",
    });

    try {
      const result = await translateMessageMutation({ messageId: message._id, force });
      setTranslatedMessages((currentTranslations) => ({
        ...currentTranslations,
        [message._id]: result,
      }));
      setAiMessageStatus(message._id, {
        type: "translate",
        state: "success",
        label: result.cacheStatus === "reused" || result.cached ? "Saved translation" : "Translation ready",
        message:
          result.translation?.note ||
          `${result.translation?.sourceLanguage || "Message"} translated to English.`,
      });
      const translationToastMessages = {
        reused: "Showing saved translation",
        refreshed: "Translation refreshed",
        fresh: "Translated to English",
      };
      toast.success(
        translationToastMessages[result.cacheStatus] ||
          (force ? "Translation refreshed" : result.cached ? "Showing saved translation" : "Translated to English")
      );
    } catch (error) {
      const messageText = getAiErrorMessage(error, "Could not translate this message");
      setAiMessageStatus(message._id, {
        type: "translate",
        state: "error",
        label: "Translation failed",
        message: messageText,
      });
      toast.error(messageText);
    } finally {
      setTranslatingMessageId(null);
    }
  };

  const handleRetryTranslation = (message) => {
    handleTranslateMessage(message, { force: true });
  };

  const handleSummarizeMessage = async (message, { force = false } = {}) => {
    const text = message.text?.trim();
    if (!text) {
      toast.error("Summarization only supports text messages");
      return;
    }

    setSummarizingMessageId(message._id);
    setAiMessageStatus(message._id, {
      type: "summarize",
      state: "loading",
      label: "Summarizing",
      message: force ? "Refreshing summary..." : "Condensing the message...",
    });

    try {
      const result = await summarizeMessageMutation({ messageId: message._id, force });
      setAiDetectionResult(result);
      setAiMessageStatus(message._id, {
        type: "summarize",
        state: "success",
        label: result.cached && !force ? "Saved summary" : "Summary ready",
        message: result.summary?.summaryText || "Summary report is ready.",
      });
      toast.success(
        force
          ? "Summary refreshed"
          : result.cached
            ? "Showing saved summary"
            : "Summary ready"
      );
    } catch (error) {
      const messageText = getAiErrorMessage(error, "Could not summarize this message");
      setAiMessageStatus(message._id, {
        type: "summarize",
        state: "error",
        label: "Summary failed",
        message: messageText,
      });
      toast.error(messageText);
    } finally {
      setSummarizingMessageId(null);
    }
  };

  const handleDescribeImageMessage = async (message, { force = false } = {}) => {
    const attachment = message.metadata?.attachments?.[0];
    if (attachment?.type !== "image") {
      toast.error("Image description only supports image attachments");
      return;
    }

    setDescribingImageMessageId(message._id);
    setAiMessageStatus(message._id, {
      type: "describe_image",
      state: "loading",
      label: "Describing image",
      message: force ? "Refreshing image description..." : "Reading visible image details...",
    });

    try {
      const result = await describeImageMessageMutation({ messageId: message._id, force });
      setAiDetectionResult(result);
      setAiMessageStatus(message._id, {
        type: "describe_image",
        state: "success",
        label: result.cached && !force ? "Saved description" : "Description ready",
        message: result.description?.descriptionText || "Image description is ready.",
      });
      toast.success(
        force
          ? "Image description refreshed"
          : result.cached
            ? "Showing saved image description"
            : "Image description ready"
      );
    } catch (error) {
      const messageText = getAiErrorMessage(error, "Could not describe this image");
      setAiMessageStatus(message._id, {
        type: "describe_image",
        state: "error",
        label: "Description failed",
        message: messageText,
      });
      toast.error(messageText);
    } finally {
      setDescribingImageMessageId(null);
    }
  };

  const handleRecheckDetection = async () => {
    if (!aiDetectionResult?.messageId) return;

    const message = messages.find((currentMessage) => currentMessage._id === aiDetectionResult.messageId);
    if (!message) {
      toast.error("Message could not be found for recheck");
      return;
    }

    setIsRecheckingDetection(true);

    try {
      if (aiDetectionResult.checkType === "link") {
        await runLinkCheckForMessage(message, { force: true });
        return;
      }

      if (aiDetectionResult.checkType === "summarize") {
        await handleSummarizeMessage(message, { force: true });
        return;
      }

      if (aiDetectionResult.checkType === "describe_image") {
        await handleDescribeImageMessage(message, { force: true });
        return;
      }

      await runDetectionForMessage(message, { force: true });
    } finally {
      setIsRecheckingDetection(false);
    }
  };

  const handleClearConversation = () => {
    if (window.confirm("Clear this chat for your account?")) {
      clearConversationMutation();
    }
  };

  const handleRemoveFriend = () => {
    if (!targetUserId) return;

    if (window.confirm(`Remove ${targetUser?.fullName || "this friend"} from your friend list?`)) {
      removeFriendMutation(targetUserId);
    }
  };

  if (loadingFriends || loadingMessages || !authUser || !conversationId) {
    return <ChatLoader />;
  }

  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-base-100"
      onDragEnter={handleChatDragEnter}
      onDragLeave={handleChatDragLeave}
      onDragOver={handleChatDragOver}
      onDrop={handleChatDrop}
    >
      <AIDetectionModal
        result={aiDetectionResult}
        isRechecking={isRecheckingDetection}
        onClose={() => setAiDetectionResult(null)}
        onRecheck={handleRecheckDetection}
      />

      <ChatHeader
        handleVideoCall={handleVideoCall}
        isClearingConversation={isClearingConversation}
        isRemovingFriend={isRemovingFriend}
        isTargetUserOnline={isTargetUserOnline}
        isSearchExpanded={isSearchExpanded}
        activeSearchMatchIndex={activeSearchMatchIndex}
        matchingMessageCount={matchingMessageCount}
        messageSearch={messageSearch}
        searchInputRef={searchInputRef}
        normalizedMessageSearch={normalizedMessageSearch}
        onChangeSearch={handleSearchChange}
        onClearConversation={handleClearConversation}
        onCollapseSearch={() => setIsSearchExpanded(false)}
        onExpandSearch={() => setIsSearchExpanded(true)}
        onJumpToNextSearchMatch={handleJumpToNextSearchMatch}
        onJumpToPreviousSearchMatch={handleJumpToPreviousSearchMatch}
        onRemoveFriend={handleRemoveFriend}
        socketReady={socketReady}
        targetUser={targetUser}
      />

      <div
        ref={chatScrollRef}
        className="chat-thread-surface relative min-h-0 flex-1 overflow-y-auto px-4 py-5"
        onScroll={updateScrollToBottomVisibility}
      >
        <div className="mx-auto max-w-4xl space-y-1.5">
          {messages.length === 0 ? (
            <ChatEmptyState
              isOnline={isTargetUserOnline}
              onAttachFile={() => fileInputRef.current?.click()}
              onSayHi={handlePrefillGreeting}
              onStartCall={handleVideoCall}
              targetUser={targetUser}
            />
          ) : (
            messages.map((message, index) => {
              const previousMessage = messages[index - 1];
              const shouldShowDateSeparator =
                !previousMessage ||
                getMessageDateKey(previousMessage.createdAt) !== getMessageDateKey(message.createdAt);
              const shouldShowNewMessagesSeparator = firstNewMessageId === message._id;

              return (
                <div key={message._id} className="space-y-1.5">
                  {shouldShowDateSeparator ? <ChatDateSeparator timestamp={message.createdAt} /> : null}
                  {shouldShowNewMessagesSeparator ? <NewMessagesSeparator /> : null}
                  <ChatMessageItem
                    authUserId={authUser._id}
                    checkingLinkMessageId={checkingLinkMessageId}
                    describingImageMessageId={describingImageMessageId}
                    detectingMessageId={detectingMessageId}
                    isActiveSearchMatch={activeSearchMessageId === message._id}
                    isHighlighted={highlightedMessageId === message._id}
                    isRunningSummarize={summarizingMessageId === message._id}
                    isRunningTranslation={translatingMessageId === message._id}
                    aiStatus={aiMessageStatuses[message._id]}
                    message={message}
                    onDeleteForEveryone={deleteMessageMutation}
                    onDeleteForMe={hideMessageMutation}
                    onDescribeImage={handleDescribeImageMessage}
                    onJumpToReply={handleJumpToMessage}
                    onReply={handleReplyToMessage}
                    onRunDetection={runDetectionForMessage}
                    onRunLinkCheck={runLinkCheckForMessage}
                    onRetryTranslation={handleRetryTranslation}
                    onSummarize={handleSummarizeMessage}
                    onTranslate={handleTranslateMessage}
                    readAt={targetUserReadAt}
                    registerMessageNode={registerMessageNode}
                    searchTerm={normalizedMessageSearch}
                    translationResult={translatedMessages[message._id]}
                  />
                </div>
              );
            })
          )}
          {typingUserId === targetUserId ? <TypingIndicator name={targetUser?.fullName} /> : null}
          <div ref={messagesEndRef} />
        </div>
        {showScrollToBottom || newIncomingMessageCount > 0 ? (
          <div className="sticky bottom-3 z-20 mt-3 flex justify-end">
            <div className="flex flex-col items-end gap-2">
              {newIncomingMessageCount > 0 ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm rounded-full shadow-lg"
                  onClick={scrollToFirstNewMessage}
                >
                  {newIncomingMessageCount} new message{newIncomingMessageCount === 1 ? "" : "s"}
                </button>
              ) : null}
              {showScrollToBottom ? (
                <button
                  type="button"
                  className="btn btn-primary btn-circle btn-sm shadow-lg"
                  onClick={scrollToLatestMessage}
                  aria-label="Jump to latest message"
                  title="Jump to latest message"
                >
                  <ArrowDownIcon className="size-4" />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <MessageComposer
        authUserId={authUser._id}
        fileInputRef={fileInputRef}
        inputRef={messageInputRef}
        isUploadingAttachment={isUploadingAttachment}
        messageText={messageText}
        onAttachmentSelect={handleAttachmentSelect}
        onChangeMessageText={handleMessageTextChange}
        onClearPendingAttachments={handleClearPendingAttachments}
        onRemovePendingAttachment={handleRemovePendingAttachment}
        onClearReply={() => setReplyingTo(null)}
        onKeyDownMessageInput={handleComposerKeyDown}
        onPasteMessageInput={handleComposerPaste}
        onOpenFilePicker={() => fileInputRef.current?.click()}
        onSubmit={handleSendMessage}
        pendingAttachments={pendingAttachments}
        replyingTo={replyingTo}
        socketReady={socketReady}
      />
      {isDraggingFiles ? (
        <div className="pointer-events-none absolute inset-0 z-50 grid place-items-center bg-base-100/55 p-6 backdrop-blur-sm">
          <div className="rounded-2xl border border-dashed border-primary/50 bg-base-100/95 px-6 py-5 text-center shadow-2xl">
            <ImagePlusIcon className="mx-auto mb-3 size-8 text-primary" />
            <p className="font-semibold">Drop files to attach</p>
            <p className="mt-1 text-sm opacity-70">They’ll appear in the composer preview.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ChatPage;
