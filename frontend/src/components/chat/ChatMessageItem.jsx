import ChatAttachment from "./ChatAttachment";
import MessageActions from "./MessageActions";
import ReplyPreview from "./ReplyPreview";

const ChatMessageItem = ({
  authUserId,
  checkingLinkMessageId,
  detectingMessageId,
  isActiveSearchMatch,
  isHighlighted,
  message,
  onDeleteForEveryone,
  onDeleteForMe,
  onJumpToReply,
  onReply,
  onRunDetection,
  onRunLinkCheck,
  readAt,
  registerMessageNode,
  searchTerm,
}) => {
  const isOwnMessage = message.senderId === authUserId;
  const attachment = message.metadata?.attachments?.[0];
  const shouldHighlight = searchTerm && message.text?.toLowerCase().includes(searchTerm);
  const isRead = isOwnMessage && readAt && new Date(message.createdAt).getTime() <= new Date(readAt).getTime();
  const isSystemMessage = message.messageType === "system" || Boolean(message.metadata?.callEvent);

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
          isRunningDetection={detectingMessageId === message._id}
          isRunningLinkCheck={checkingLinkMessageId === message._id}
          message={message}
          onDeleteForEveryone={onDeleteForEveryone}
          onDeleteForMe={onDeleteForMe}
          onReply={onReply}
          onRunLinkCheck={onRunLinkCheck}
          onRunDetection={onRunDetection}
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
          isRunningDetection={detectingMessageId === message._id}
          isRunningLinkCheck={checkingLinkMessageId === message._id}
          message={message}
          onDeleteForEveryone={onDeleteForEveryone}
          onDeleteForMe={onDeleteForMe}
          onReply={onReply}
          onRunLinkCheck={onRunLinkCheck}
          onRunDetection={onRunDetection}
        />
      ) : null}
    </div>
  );
};

export default ChatMessageItem;
