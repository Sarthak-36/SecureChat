import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import AIDetectionModal from "../components/AIDetectionModal";
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
  attachment: message.metadata?.attachments?.[0]
    ? {
        name: message.metadata.attachments[0].name,
        type: message.metadata.attachments[0].type,
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

const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);
  const messageNodesRef = useRef({});
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [socketReady, setSocketReady] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
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
      .map((message) => message._id);
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
  }, [history]);

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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUserId]);

  useEffect(() => {
    if (isSearchExpanded) return;
    setMessageSearch("");
    setActiveSearchMatchIndex(0);
  }, [isSearchExpanded]);

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

  useEffect(() => {
    if (!socketReady || !conversationId || !authUser?._id) return;

    const latestMessage = messages[messages.length - 1];
    if (latestMessage && latestMessage.senderId === targetUserId && document.visibilityState === "visible") {
      socketRef.current?.send(
        JSON.stringify({
          type: "mark_conversation_read",
          conversationId,
        })
      );
    }
  }, [authUser?._id, conversationId, messages, socketReady, targetUserId]);

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

  const handleAttachmentSelect = async (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setIsUploadingAttachment(true);

    try {
      const response = await uploadChatAttachment(selectedFile);
      setPendingAttachment(response.attachment);
      toast.success("Attachment uploaded");
      window.requestAnimationFrame(() => {
        messageInputRef.current?.focus();
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not upload attachment");
    } finally {
      setIsUploadingAttachment(false);
      event.target.value = "";
    }
  };

  const handleSearchChange = (event) => {
    setMessageSearch(event.target.value);
  };

  const handleJumpToNextSearchMatch = () => {
    if (!matchingMessageCount) return;

    setActiveSearchMatchIndex((currentIndex) => (currentIndex + 1) % matchingMessageCount);
  };

  const handleJumpToPreviousSearchMatch = () => {
    if (!matchingMessageCount) return;

    setActiveSearchMatchIndex((currentIndex) =>
      currentIndex === 0 ? matchingMessageCount - 1 : currentIndex - 1
    );
  };

  const handleComposerKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();

    const trimmedText = messageText.trim();
    if (!trimmedText && !pendingAttachment) {
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

  const handleSendMessage = (event) => {
    event.preventDefault();

    if (!socketReady || !socketRef.current) return;

    const trimmedText = messageText.trim();
    if (!trimmedText && !pendingAttachment) return;

    const metadata = {};
    if (pendingAttachment) {
      metadata.attachments = [pendingAttachment];
    }
    if (replyingTo) {
      metadata.replyTo = replyingTo;
    }

    socketRef.current.send(
      JSON.stringify({
        type: "chat_message",
        recipientId: targetUserId,
        text: trimmedText,
        metadata,
      })
    );

    setMessageText("");
    setPendingAttachment(null);
    setReplyingTo(null);
    stopTyping();
    queryClient.invalidateQueries({ queryKey: ["friends"] });
  };

  const handleVideoCall = () => {
    if (!socketReady || !socketRef.current) {
      toast.error("Chat connection is still loading");
      return;
    }

    const callId = crypto.randomUUID();
    socketRef.current.send(
      JSON.stringify({
        type: "call_invite",
        callId,
        recipientId: targetUserId,
      })
    );

    toast.success(`Calling ${targetUser?.fullName || "your friend"}...`);
    navigate(`/call/${callId}?mode=outgoing&peer=${targetUserId}`);
  };

  const runDetectionForMessage = async (message, { force = false } = {}) => {
    const attachment = message.metadata?.attachments?.[0];
    const text = message.text?.trim();

    if (attachment?.type === "image") {
      setDetectingMessageId(message._id);

      try {
        const result = await detectImageMutation({ messageId: message._id, force });
        setAiDetectionResult(result);
        toast.success(
          force
            ? "AI image detection refreshed"
            : result.cached
              ? "Showing saved AI result"
              : "AI image detection complete"
        );
      } catch (error) {
        toast.error(error?.response?.data?.message || "Could not run AI detection");
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

    try {
      const result = await detectTextMutation({ messageId: message._id, force });
      setAiDetectionResult(result);
      toast.success(
        force
          ? "AI text detection refreshed"
          : result.cached
            ? "Showing saved AI result"
            : "AI text detection complete"
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not run AI detection");
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

    try {
      const result = await detectLinkMutation({ messageId: message._id, force });
      setAiDetectionResult(result);
      toast.success(
        force
          ? "Suspicious link check refreshed"
          : result.cached
            ? "Showing saved link safety result"
            : "Suspicious link check complete"
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not check the link");
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

    try {
      const result = await translateMessageMutation({ messageId: message._id, force });
      setTranslatedMessages((currentTranslations) => ({
        ...currentTranslations,
        [message._id]: result,
      }));
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
      toast.error(error?.response?.data?.message || "Could not translate this message");
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

    try {
      const result = await summarizeMessageMutation({ messageId: message._id, force });
      setAiDetectionResult(result);
      toast.success(
        force
          ? "Summary refreshed"
          : result.cached
            ? "Showing saved summary"
            : "Summary ready"
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not summarize this message");
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

    try {
      const result = await describeImageMessageMutation({ messageId: message._id, force });
      setAiDetectionResult(result);
      toast.success(
        force
          ? "Image description refreshed"
          : result.cached
            ? "Showing saved image description"
            : "Image description ready"
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not describe this image");
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
    <div className="h-[93vh] flex flex-col bg-base-100">
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

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-4xl space-y-3">
          {messages.map((message) => (
            <ChatMessageItem
              key={message._id}
              authUserId={authUser._id}
              checkingLinkMessageId={checkingLinkMessageId}
              describingImageMessageId={describingImageMessageId}
              detectingMessageId={detectingMessageId}
              isActiveSearchMatch={activeSearchMessageId === message._id}
              isHighlighted={highlightedMessageId === message._id}
              isRunningSummarize={summarizingMessageId === message._id}
              isRunningTranslation={translatingMessageId === message._id}
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
          ))}
          {typingUserId === targetUserId ? <TypingIndicator name={targetUser?.fullName} /> : null}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <MessageComposer
        authUserId={authUser._id}
        fileInputRef={fileInputRef}
        inputRef={messageInputRef}
        isUploadingAttachment={isUploadingAttachment}
        messageText={messageText}
        onAttachmentSelect={handleAttachmentSelect}
        onChangeMessageText={handleMessageTextChange}
        onClearPendingAttachment={() => setPendingAttachment(null)}
        onClearReply={() => setReplyingTo(null)}
        onKeyDownMessageInput={handleComposerKeyDown}
        onOpenFilePicker={() => fileInputRef.current?.click()}
        onSubmit={handleSendMessage}
        pendingAttachment={pendingAttachment}
        replyingTo={replyingTo}
        socketReady={socketReady}
      />
    </div>
  );
};

export default ChatPage;
