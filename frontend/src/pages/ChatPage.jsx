import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import useChatScroll from "../hooks/useChatScroll";
import useMessageSearch from "../hooks/useMessageSearch";
import useMessageAiActions from "../hooks/useMessageAiActions";
import usePendingAttachments from "../hooks/usePendingAttachments";
import {
  clearConversation,
  deleteMessage,
  getChatToken,
  getMessages,
  getUserFriends,
  hideMessageForMe,
  removeFriend,
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
  const messageNodesRef = useRef({});
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [socketReady, setSocketReady] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [typingUserId, setTypingUserId] = useState(null);
  const [targetUserReadAt, setTargetUserReadAt] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [isTargetUserOnline, setIsTargetUserOnline] = useState(false);

  const { authUser } = useAuthUser();
  const clearReply = useCallback(() => setReplyingTo(null), []);

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
  const {
    clearPendingAttachments,
    handleAttachmentSelect,
    handleChatDragEnter,
    handleChatDragLeave,
    handleChatDragOver,
    handleChatDrop,
    handleComposerPaste,
    handleRemovePendingAttachment,
    isDraggingFiles,
    isUploadingAttachment,
    pendingAttachments,
    uploadPendingAttachments,
  } = usePendingAttachments({ inputRef: messageInputRef });
  const {
    activeSearchMatchIndex,
    activeSearchMessageId,
    handleJumpToNextSearchMatch,
    handleJumpToPreviousSearchMatch,
    handleSearchChange,
    isSearchExpanded,
    matchingMessageCount,
    messageSearch,
    normalizedMessageSearch,
    searchInputRef,
    setIsSearchExpanded,
  } = useMessageSearch({
    clearReply,
    inputRef: messageInputRef,
    messageNodesRef,
    messages,
    replyingTo,
  });
  const {
    chatScrollRef,
    firstNewMessageId,
    messagesEndRef,
    newIncomingMessageCount,
    noteIncomingMessage,
    scrollToFirstNewMessage,
    scrollToLatestMessage,
    showScrollToBottom,
    updateScrollToBottomVisibility,
  } = useChatScroll({
    authUserId: authUser?._id,
    messageNodesRef,
    messages,
    typingUserId,
  });
  const {
    aiDetectionResult,
    aiMessageStatuses,
    checkingLinkMessageId,
    describingImageMessageId,
    detectingMessageId,
    handleDescribeImageMessage,
    handleRecheckDetection,
    handleRetryTranslation,
    handleSummarizeMessage,
    handleTranslateMessage,
    isRecheckingDetection,
    resetMessageAiState,
    runDetectionForMessage,
    runLinkCheckForMessage,
    setAiDetectionResult,
    summarizingMessageId,
    translatedMessages,
    translatingMessageId,
  } = useMessageAiActions({ messages });

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

  useEffect(() => {
    setMessages(history);
    setTargetUserReadAt(getLatestReadAt(history));
    resetMessageAiState();
  }, [history, resetMessageAiState]);

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
          noteIncomingMessage(payload.message._id);
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
  }, [authUser?._id, conversationId, noteIncomingMessage, queryClient, targetUserId, tokenData?.token]);

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

  const lastMessageIdRef = useRef(null);

  useEffect(() => {
    if (!socketReady || !conversationId || !authUser?._id) return;

    const latestMessage = messages[messages.length - 1];
    if (!latestMessage) return;

    // prevent infinite loop
    if (lastMessageIdRef.current === latestMessage._id) return;

    lastMessageIdRef.current = latestMessage._id;

    if (latestMessage.senderId === targetUserId && document.visibilityState === "visible") {
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
      try {
        uploadedAttachments = await uploadPendingAttachments();
      } catch (error) {
        toast.error(error?.response?.data?.message || "Could not upload attachment");
        return;
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
    clearPendingAttachments();
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
        onClearPendingAttachments={clearPendingAttachments}
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
