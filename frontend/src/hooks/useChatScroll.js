import { useCallback, useEffect, useRef, useState } from "react";

const useChatScroll = ({ authUserId, messageNodesRef, messages, typingUserId }) => {
  const messagesEndRef = useRef(null);
  const chatScrollRef = useRef(null);
  const isAwayFromBottomRef = useRef(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [newIncomingMessageCount, setNewIncomingMessageCount] = useState(0);
  const [firstNewMessageId, setFirstNewMessageId] = useState(null);

  const updateScrollToBottomVisibility = useCallback(() => {
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
  }, []);

  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    const shouldAutoScroll =
      !isAwayFromBottomRef.current || latestMessage?.senderId === authUserId;

    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      if (latestMessage?.senderId === authUserId) {
        setNewIncomingMessageCount(0);
        setFirstNewMessageId(null);
      }
    }
  }, [authUserId, messages, typingUserId]);

  useEffect(() => {
    window.requestAnimationFrame(updateScrollToBottomVisibility);
  }, [messages.length, typingUserId, updateScrollToBottomVisibility]);

  const noteIncomingMessage = useCallback((messageId) => {
    if (!isAwayFromBottomRef.current) return;

    setFirstNewMessageId((currentMessageId) => currentMessageId || messageId);
    setNewIncomingMessageCount((currentCount) => currentCount + 1);
  }, []);

  const scrollToLatestMessage = useCallback(() => {
    setNewIncomingMessageCount(0);
    setFirstNewMessageId(null);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const scrollToFirstNewMessage = useCallback(() => {
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
  }, [firstNewMessageId, messageNodesRef, scrollToLatestMessage]);

  return {
    chatScrollRef,
    firstNewMessageId,
    messagesEndRef,
    newIncomingMessageCount,
    noteIncomingMessage,
    scrollToFirstNewMessage,
    scrollToLatestMessage,
    showScrollToBottom,
    updateScrollToBottomVisibility,
  };
};

export default useChatScroll;
