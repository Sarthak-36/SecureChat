import ChatAttachment from "./ChatAttachment";
import MessageActions from "./MessageActions";
import ReplyPreview from "./ReplyPreview";

const ChatMessageItem = ({
  authUserId,
  checkingLinkMessageId,
  detectingMessageId,
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
        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
          isOwnMessage ? "chat-bubble-own" : "bg-base-200"
        } ${shouldHighlight ? "ring-2 ring-warning/70" : ""} ${
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
        {message.text ? <p className="whitespace-pre-wrap break-words">{message.text}</p> : null}
        {attachment ? <ChatAttachment attachment={attachment} /> : null}
        <div className="mt-2 flex items-center justify-between gap-3 text-[11px] opacity-70">
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
