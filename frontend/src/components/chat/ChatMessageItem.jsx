import { RotateCwIcon } from "lucide-react";

import ChatAttachment from "./ChatAttachment";
import MessageActions from "./MessageActions";
import ReplyPreview from "./ReplyPreview";

const ChatMessageItem = ({
  authUserId,
  checkingLinkMessageId,
  describingImageMessageId,
  detectingMessageId,
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
  const attachment = message.metadata?.attachments?.[0];
  const shouldHighlight = searchTerm && message.text?.toLowerCase().includes(searchTerm);
  const isRead = isOwnMessage && readAt && new Date(message.createdAt).getTime() <= new Date(readAt).getTime();
  const isSystemMessage = message.messageType === "system" || Boolean(message.metadata?.callEvent);
  const translationStatusLabel =
    {
      reused: "Saved",
      refreshed: "Refreshed",
      fresh: "Fresh",
    }[translationResult?.cacheStatus] || (translationResult?.cached ? "Saved" : "Fresh");

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
    <div className={`flex items-start gap-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
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
        className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${
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
        {translationResult?.translation?.translatedText ? (
          <div className="mt-2 rounded-xl border border-current/10 bg-base-100/70 px-3 py-2 text-sm">
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-60">
                Translated to English
              </p>
              <div className="flex items-center gap-2">
                <p className="text-[11px] opacity-60">{translationStatusLabel}</p>
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
            <p className="whitespace-pre-wrap break-words leading-[1.35]">
              {translationResult.translation.translatedText}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] opacity-70">
              <span>Source: {translationResult.translation.sourceLanguage || "Unknown"}</span>
              {typeof translationResult.translation.confidencePercent === "number" ? (
                <span>Confidence: {translationResult.translation.confidencePercent}%</span>
              ) : null}
            </div>
            {translationResult.translation.note ? (
              <p className="mt-1 text-[11px] opacity-70">{translationResult.translation.note}</p>
            ) : null}
          </div>
        ) : null}
        {attachment ? <ChatAttachment attachment={attachment} /> : null}
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
