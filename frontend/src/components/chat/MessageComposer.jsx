import { ImagePlusIcon, SendHorizontalIcon, XIcon } from "lucide-react";

import ReplyPreview from "./ReplyPreview";

const MessageComposer = ({
  authUserId,
  fileInputRef,
  inputRef,
  isUploadingAttachment,
  messageText,
  onAttachmentSelect,
  onChangeMessageText,
  onClearReply,
  onClearPendingAttachment,
  onKeyDownMessageInput,
  onOpenFilePicker,
  onSubmit,
  pendingAttachment,
  replyingTo,
  socketReady,
}) => (
  <form onSubmit={onSubmit} className="border-t border-base-300 px-4 py-4">
    <div className="max-w-4xl mx-auto space-y-3">
      {replyingTo ? (
        <ReplyPreview message={replyingTo} currentUserId={authUserId} onCancel={onClearReply} />
      ) : null}

      {pendingAttachment ? (
        <div className="flex items-center justify-between rounded-2xl bg-base-200 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{pendingAttachment.name}</p>
            <p className="text-sm opacity-70">{pendingAttachment.mimeType}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-circle btn-sm"
            onClick={onClearPendingAttachment}
          >
            <XIcon className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <input ref={fileInputRef} type="file" className="hidden" onChange={onAttachmentSelect} />
        <button
          type="button"
          className="btn btn-outline"
          onClick={onOpenFilePicker}
          disabled={isUploadingAttachment}
        >
          <ImagePlusIcon className="size-4" />
          {isUploadingAttachment ? "Uploading..." : "Attach"}
        </button>

        <textarea
          ref={inputRef}
          value={messageText}
          onChange={onChangeMessageText}
          onKeyDown={onKeyDownMessageInput}
          placeholder="Type a message..."
          rows={1}
          className="textarea textarea-bordered flex-1 resize-none"
        />

        <button
          className="btn btn-primary"
          type="submit"
          disabled={!socketReady || (!messageText.trim() && !pendingAttachment)}
        >
          <SendHorizontalIcon className="size-4" />
          Send
        </button>
      </div>
    </div>
  </form>
);

export default MessageComposer;
