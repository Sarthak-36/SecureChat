import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ClipboardIcon,
  LanguagesIcon,
  LoaderCircleIcon,
  RotateCwIcon,
  SparklesIcon,
  VideoIcon,
} from "lucide-react";
import toast from "react-hot-toast";

import ChatAttachment from "./ChatAttachment";
import MessageActions from "./MessageActions";
import ReplyPreview from "./ReplyPreview";

const ChatMessageItem = ({
  authUserId,
  checkingLinkMessageId,
  describingImageMessageId,
  detectingMessageId,
  aiStatus,
  isActiveSearchMatch,
  isHighlighted,
  isRunningSummarize,
  isRunningTranslation,
  message,
  onDeleteForEveryone,
  onDeleteForMe,
  onDescribeImage,
  onJumpToReply,
  onReply,
  onRunDetection,
  onRunLinkCheck,
  onRetryTranslation,
  onSummarize,
  onTranslate,
  readAt,
  registerMessageNode,
  searchTerm,
  translationResult,
}) => {
  const isOwnMessage = message.senderId === authUserId;
  const attachments = Array.isArray(message.metadata?.attachments) ? message.metadata.attachments : [];
  const attachment = attachments[0];
  const shouldHighlight = searchTerm && message.text?.toLowerCase().includes(searchTerm);
  const isRead = isOwnMessage && readAt && new Date(message.createdAt).getTime() <= new Date(readAt).getTime();
  const callEvent = message.metadata?.callEvent;
  const isSystemMessage = message.messageType === "system" || Boolean(callEvent);
  const translationStatusLabel =
    {
      reused: "Saved",
      refreshed: "Refreshed",
      fresh: "Fresh",
    }[translationResult?.cacheStatus] || (translationResult?.cached ? "Saved" : "Fresh");
  const translatedText = translationResult?.translation?.translatedText;
  const confidencePercent = translationResult?.translation?.confidencePercent;
  const sourceLanguage = translationResult?.translation?.sourceLanguage || "Unknown source";
  const translationModel = translationResult?.translation?.models?.translation;
  const shouldShowAiStatus =
    aiStatus && !(aiStatus.type === "translate" && aiStatus.state === "success" && translatedText);
  const aiStatusTone =
    {
      loading: "border-info/20 bg-info/10 text-info",
      success: "border-success/20 bg-success/10 text-success",
      error: "border-error/20 bg-error/10 text-error",
    }[aiStatus?.state] || "border-base-content/10 bg-base-100/80";
  const AiStatusIcon =
    {
      loading: LoaderCircleIcon,
      success: CheckCircle2Icon,
      error: AlertCircleIcon,
    }[aiStatus?.state] || SparklesIcon;
  const retryAiStatus = () => {
    if (!aiStatus || aiStatus.state !== "error") return;

    if (aiStatus.type === "translate") {
      onRetryTranslation(message);
      return;
    }

    if (aiStatus.type === "link") {
      onRunLinkCheck(message, { force: true });
      return;
    }

    if (aiStatus.type === "summarize") {
      onSummarize(message, { force: true });
      return;
    }

    if (aiStatus.type === "describe_image") {
      onDescribeImage(message, { force: true });
      return;
    }

    onRunDetection(message, { force: true });
  };
  const copyTranslatedText = async () => {
    if (!translatedText) return;

    try {
      await navigator.clipboard.writeText(translatedText);
      toast.success("Translation copied");
    } catch {
      toast.error("Could not copy translation");
    }
  };

  if (callEvent) {
    const isMissedCall = callEvent.status === "missed";
    const durationLabel = callEvent.durationLabel;
    const isCallFromCurrentUser = message.senderId === authUserId;
    const callTitle = `${isCallFromCurrentUser ? "Outgoing" : "Incoming"} video call`;

    return (
      <div className={`flex items-start gap-1.5 ${isCallFromCurrentUser ? "justify-end" : "justify-start"}`}>
        {!isCallFromCurrentUser ? <div className="w-6 shrink-0" aria-hidden="true" /> : null}
        <div
          ref={(node) => registerMessageNode(message._id, node)}
          data-message-id={message._id}
          className={`max-w-[80%] rounded-2xl border px-3 py-2 text-sm shadow-sm sm:max-w-[74%] ${
            isMissedCall
              ? "border-warning/20 bg-warning/10"
              : "border-success/20 bg-success/10"
          } ${isActiveSearchMatch ? "ring-2 ring-warning ring-offset-2 ring-offset-base-100" : ""} ${
            isHighlighted ? "ring-2 ring-info ring-offset-2 ring-offset-base-100" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-full ${
                isMissedCall ? "bg-warning/15 text-warning" : "bg-success/15 text-success"
              }`}
            >
              <VideoIcon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{callTitle}</p>
              <p className={`text-xs ${isMissedCall ? "text-warning" : "opacity-70"}`}>
                {isMissedCall ? "Missed" : durationLabel ? `Duration ${durationLabel}` : "Completed"}
              </p>
            </div>
          </div>
          <div className="mt-1.5 text-right text-[11px] opacity-60">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
        {isCallFromCurrentUser ? <div className="w-6 shrink-0" aria-hidden="true" /> : null}
      </div>
    );
  }

  if (isSystemMessage) {
    return (
      <div className="flex justify-center">
        <div
          ref={(node) => registerMessageNode(message._id, node)}
          data-message-id={message._id}
          className={`rounded-full bg-base-200 px-4 py-2 text-sm opacity-75 shadow-sm ${
            isActiveSearchMatch ? "ring-2 ring-warning ring-offset-2 ring-offset-base-100" : ""
          } ${
            isHighlighted ? "ring-2 ring-info ring-offset-2 ring-offset-base-100" : ""
          }`}
        >
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex items-start gap-1.5 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      {!isOwnMessage ? (
        <MessageActions
          canDeleteForEveryone={false}
          isRunningDescribeImage={describingImageMessageId === message._id}
          isRunningDetection={detectingMessageId === message._id}
          isRunningLinkCheck={checkingLinkMessageId === message._id}
          isRunningSummarize={isRunningSummarize}
          isRunningTranslation={isRunningTranslation}
          message={message}
          onDeleteForEveryone={onDeleteForEveryone}
          onDeleteForMe={onDeleteForMe}
          onDescribeImage={onDescribeImage}
          onReply={onReply}
          onRunLinkCheck={onRunLinkCheck}
          onRunDetection={onRunDetection}
          onRetryTranslation={onRetryTranslation}
          onSummarize={onSummarize}
          onTranslate={onTranslate}
        />
      ) : null}
      <div
        ref={(node) => registerMessageNode(message._id, node)}
        data-message-id={message._id}
        className={`message-bubble max-w-[80%] rounded-2xl px-3 py-2 shadow-sm sm:max-w-[74%] ${
          isOwnMessage ? "chat-bubble-own" : "bg-base-200"
        } ${shouldHighlight ? "ring-2 ring-warning/40" : ""} ${
          isActiveSearchMatch ? "ring-2 ring-warning ring-offset-2 ring-offset-base-100" : ""
        } ${
          isHighlighted ? "ring-2 ring-info ring-offset-2 ring-offset-base-100" : ""
        }`}
      >
        {message.metadata?.replyTo ? (
          <ReplyPreview
            compact
            message={message.metadata.replyTo}
            currentUserId={authUserId}
            onJump={
              message.metadata.replyTo.messageId
                ? () => onJumpToReply(message.metadata.replyTo.messageId)
                : undefined
            }
          />
        ) : null}
        {message.text ? (
          <p className="whitespace-pre-wrap break-words leading-[1.35]">{message.text}</p>
        ) : null}
        {translatedText ? (
          <div className="mt-2 overflow-hidden rounded-lg border border-base-content/10 bg-base-100/80 text-sm shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3 border-b border-base-content/10 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-info/10 text-info">
                  <LanguagesIcon className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">English translation</p>
                  <p className="truncate text-[11px] opacity-65">{sourceLanguage}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-base-200 px-2 py-1 text-[11px] font-medium">
                  <CheckCircle2Icon className="size-3 text-success" />
                  {translationStatusLabel}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-circle btn-xs"
                  onClick={copyTranslatedText}
                  title="Copy translation"
                >
                  <ClipboardIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-circle btn-xs"
                  onClick={() => onRetryTranslation(message)}
                  disabled={isRunningTranslation}
                  title="Retry translation"
                >
                  <RotateCwIcon className={`size-3 ${isRunningTranslation ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
            <p className="px-3 py-2.5 whitespace-pre-wrap break-words leading-[1.45]">
              {translatedText}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 border-t border-base-content/10 px-3 py-2 text-[11px] opacity-75">
              {typeof confidencePercent === "number" ? (
                <span className="rounded-full bg-base-200 px-2 py-1">
                  Confidence {confidencePercent}%
                </span>
              ) : null}
              {translationModel ? (
                <span className="rounded-full bg-base-200 px-2 py-1">{translationModel}</span>
              ) : null}
              {translationResult.translation.note ? (
                <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-base-200 px-2 py-1">
                  <SparklesIcon className="size-3 shrink-0" />
                  <span className="truncate">{translationResult.translation.note}</span>
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
        {shouldShowAiStatus ? (
          <div
            className={`mt-2 rounded-lg border px-3 py-2 text-sm shadow-sm backdrop-blur ${aiStatusTone}`}
          >
            <div className="flex items-start gap-2">
              <AiStatusIcon
                className={`mt-0.5 size-4 shrink-0 ${aiStatus.state === "loading" ? "animate-spin" : ""}`}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{aiStatus.label}</p>
                {aiStatus.message ? (
                  <p className="mt-0.5 line-clamp-2 break-words text-xs opacity-80">{aiStatus.message}</p>
                ) : null}
              </div>
              {aiStatus.state === "error" ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs shrink-0"
                  onClick={retryAiStatus}
                >
                  Retry
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {attachments.length > 0 ? (
          <div className="mt-2 space-y-2">
            {attachments.map((currentAttachment, index) => (
              <ChatAttachment
                key={`${currentAttachment.url || currentAttachment.name}-${index}`}
                attachment={currentAttachment}
              />
            ))}
          </div>
        ) : null}
        <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] opacity-70">
          <p>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          {isOwnMessage ? <span>{isRead ? "Read" : "Sent"}</span> : null}
        </div>
      </div>
      {isOwnMessage ? (
        <MessageActions
          canDeleteForEveryone
          isRunningDescribeImage={describingImageMessageId === message._id}
          isRunningDetection={detectingMessageId === message._id}
          isRunningLinkCheck={checkingLinkMessageId === message._id}
          isRunningSummarize={isRunningSummarize}
          isRunningTranslation={isRunningTranslation}
          message={message}
          onDeleteForEveryone={onDeleteForEveryone}
          onDeleteForMe={onDeleteForMe}
          onDescribeImage={onDescribeImage}
          onReply={onReply}
          onRunLinkCheck={onRunLinkCheck}
          onRunDetection={onRunDetection}
          onRetryTranslation={onRetryTranslation}
          onSummarize={onSummarize}
          onTranslate={onTranslate}
        />
      ) : null}
    </div>
  );
};

export default ChatMessageItem;
