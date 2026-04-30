const ReplyPreview = ({ compact = false, message, currentUserId, onCancel, onJump }) => {
  if (!message) return null;

  const isOwnMessage = message.senderId === currentUserId;
  const attachment = message.attachment;
  const summaryText =
    message.text?.trim() ||
    (attachment ? `${attachment.type === "image" ? "Photo" : "Attachment"}: ${attachment.name || "File"}` : "Message");

  return (
    <div
      className={`rounded-2xl border border-current/10 bg-base-100/70 px-3 py-2 ${
        compact ? "mb-2" : ""
      } ${onJump ? "cursor-pointer transition hover:bg-base-100/90" : ""}`}
      onClick={onJump}
      onKeyDown={(event) => {
        if (onJump && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onJump();
        }
      }}
      role={onJump ? "button" : undefined}
      tabIndex={onJump ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold opacity-70">{isOwnMessage ? "You" : "Replying to them"}</p>
          <p className="truncate text-sm opacity-80">{summaryText}</p>
        </div>
        {onCancel ? (
          <button type="button" className="btn btn-ghost btn-xs" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default ReplyPreview;
