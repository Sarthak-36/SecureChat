import {
  FileIcon,
  ImagePlusIcon,
  LoaderCircleIcon,
  SendHorizontalIcon,
  WifiIcon,
  WifiOffIcon,
  XIcon,
} from "lucide-react";

import ReplyPreview from "./ReplyPreview";

const formatAttachmentSize = (size) => {
  if (!Number.isFinite(size) || size <= 0) return null;

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;

  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
};

const getAttachmentLabel = (attachment) => {
  if (attachment.type === "image") return "Image";
  if (attachment.type === "video") return "Video";
  if (attachment.type === "audio") return "Audio";
  return attachment.mimeType || "File";
};

const MessageComposer = ({
  authUserId,
  fileInputRef,
  inputRef,
  isUploadingAttachment,
  messageText,
  onAttachmentSelect,
  onChangeMessageText,
  onClearReply,
  onClearPendingAttachments,
  onPasteMessageInput,
  onRemovePendingAttachment,
  onKeyDownMessageInput,
  onOpenFilePicker,
  onSubmit,
  pendingAttachments = [],
  replyingTo,
  socketReady,
}) => {
  const canSend = socketReady && !isUploadingAttachment && (messageText.trim() || pendingAttachments.length > 0);

  return (
  <form onSubmit={onSubmit} className="border-t border-base-300 bg-base-100/95 px-3 py-3 backdrop-blur sm:px-4">
    <div className="mx-auto max-w-4xl space-y-3">
      {replyingTo ? (
        <ReplyPreview message={replyingTo} currentUserId={authUserId} onCancel={onClearReply} />
      ) : null}

      {pendingAttachments.length > 0 ? (
        <div className="rounded-xl border border-base-content/10 bg-base-200/80 px-3 py-2 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase opacity-60">
              {pendingAttachments.length} attachment{pendingAttachments.length === 1 ? "" : "s"} ready
            </p>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={onClearPendingAttachments}
            >
              Clear all
            </button>
          </div>
          <div className="grid max-h-44 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {pendingAttachments.map((attachment, index) => {
              const attachmentSize = formatAttachmentSize(attachment.size);
              const attachmentMeta = [getAttachmentLabel(attachment), attachmentSize].filter(Boolean).join(" · ");
              const isImage = attachment.type === "image";
              const previewUrl = attachment.previewUrl || attachment.url;

              return (
                <div
                  key={attachment.id || `${previewUrl}-${index}`}
                  className="group/attachment flex min-w-0 items-center gap-3 rounded-xl border border-base-content/10 bg-base-100 p-2 shadow-sm"
                >
                  <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-base-200 text-primary">
                    {isImage && previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={attachment.name || "Selected image"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileIcon className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{attachment.name}</p>
                    <p className="truncate text-xs opacity-65">{attachmentMeta || "Attachment"}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-circle btn-xs shrink-0 text-base-content/60 hover:bg-error/10 hover:text-error"
                    onClick={() => onRemovePendingAttachment(index)}
                    title="Remove attachment"
                    aria-label="Remove attachment"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-base-content/10 bg-base-200/70 p-2 shadow-sm">
        <div className="flex items-end gap-2">
        <input ref={fileInputRef} type="file" className="hidden" multiple onChange={onAttachmentSelect} />
        <button
          type="button"
          className="btn btn-ghost btn-circle shrink-0"
          onClick={onOpenFilePicker}
          disabled={isUploadingAttachment}
          title={isUploadingAttachment ? "Uploading attachments" : "Attach file"}
          aria-label={isUploadingAttachment ? "Uploading attachments" : "Attach file"}
        >
          {isUploadingAttachment ? (
            <LoaderCircleIcon className="size-5 animate-spin" />
          ) : (
            <ImagePlusIcon className="size-5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <textarea
            ref={inputRef}
            value={messageText}
            onChange={onChangeMessageText}
            onKeyDown={onKeyDownMessageInput}
            onPaste={onPasteMessageInput}
            placeholder={socketReady ? "Type a message..." : "Reconnecting..."}
            rows={1}
            className="textarea min-h-11 w-full resize-none border-0 bg-transparent px-2 py-2 leading-6 focus:outline-none"
          />
        </div>

        <button
          className="btn btn-primary btn-circle shrink-0"
          type="submit"
          disabled={!canSend}
          title={socketReady ? "Send message" : "Chat is reconnecting"}
          aria-label={socketReady ? "Send message" : "Chat is reconnecting"}
        >
          <SendHorizontalIcon className="size-5" />
        </button>
        </div>

        <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-1 text-[11px] opacity-65">
          <span className="inline-flex items-center gap-1">
            {socketReady ? <WifiIcon className="size-3.5" /> : <WifiOffIcon className="size-3.5" />}
            {socketReady ? "Connected" : "Reconnecting"}
          </span>
          <span>
            {isUploadingAttachment
              ? "Uploading..."
              : pendingAttachments.length > 1
                ? "Files send separately"
                : messageText.length
                  ? `${messageText.length} chars`
                  : "Enter to send"}
          </span>
        </div>
      </div>
    </div>
  </form>
  );
};

export default MessageComposer;
