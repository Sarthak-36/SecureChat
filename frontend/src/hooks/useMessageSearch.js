import { useEffect, useMemo, useRef, useState } from "react";

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

const focusComposerOnWideScreen = (inputRef) => {
  if (typeof window === "undefined" || !window.matchMedia("(min-width: 768px)").matches) {
    return;
  }

  window.requestAnimationFrame(() => {
    inputRef?.current?.focus({ preventScroll: true });
  });
};

const useMessageSearch = ({ clearReply, inputRef, messageNodesRef, messages, replyingTo }) => {
  const searchInputRef = useRef(null);
  const [messageSearch, setMessageSearch] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState(0);

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
          focusComposerOnWideScreen(inputRef);
          return;
        }

        if (replyingTo) {
          event.preventDefault();
          clearReply();
          focusComposerOnWideScreen(inputRef);
        }
      }
    };

    window.addEventListener("keydown", handleChatShortcut);

    return () => {
      window.removeEventListener("keydown", handleChatShortcut);
    };
  }, [clearReply, inputRef, isSearchExpanded, replyingTo]);

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
  }, [activeSearchMessageId, messageNodesRef]);

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

  return {
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
  };
};

export default useMessageSearch;
