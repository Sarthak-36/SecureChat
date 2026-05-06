import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import {
  describeImageMessage,
  detectImageMessage,
  detectLinkMessage,
  detectTextMessage,
  summarizeMessage,
  translateMessageToEnglish,
} from "../lib/api";
import { containsLink } from "../lib/links";

const getAiErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message || fallbackMessage;

const useMessageAiActions = ({ messages }) => {
  const [aiDetectionResult, setAiDetectionResult] = useState(null);
  const [detectingMessageId, setDetectingMessageId] = useState(null);
  const [checkingLinkMessageId, setCheckingLinkMessageId] = useState(null);
  const [summarizingMessageId, setSummarizingMessageId] = useState(null);
  const [describingImageMessageId, setDescribingImageMessageId] = useState(null);
  const [isRecheckingDetection, setIsRecheckingDetection] = useState(false);
  const [translatedMessages, setTranslatedMessages] = useState({});
  const [translatingMessageId, setTranslatingMessageId] = useState(null);
  const [aiMessageStatuses, setAiMessageStatuses] = useState({});

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

  const setAiMessageStatus = (messageId, status) => {
    setAiMessageStatuses((currentStatuses) => ({
      ...currentStatuses,
      [messageId]: {
        updatedAt: new Date().toISOString(),
        ...status,
      },
    }));
  };

  const resetMessageAiState = useCallback(() => {
    setTranslatedMessages({});
    setAiMessageStatuses({});
  }, []);

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

    if (!text || !containsLink(text)) {
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

  return {
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
  };
};

export default useMessageAiActions;
