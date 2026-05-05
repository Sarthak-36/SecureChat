import { DownloadIcon, EyeIcon, FileIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

const formatFileSize = (size) => {
  if (!Number.isFinite(size) || size <= 0) return null;

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getSafeFileName = (name) => name?.trim() || "attachment";

const downloadAttachment = async (attachment) => {
  try {
    const response = await fetch(attachment.url);

    if (!response.ok) {
      throw new Error("Download request failed");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = getSafeFileName(attachment.name);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    toast.error("Could not download attachment");
  }
};

const AttachmentShell = ({ attachment, children }) => (
  <div className="rounded-xl border border-current/15 bg-base-100/70 p-2 text-sm">
    <div className="mb-2 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-base-200">
          <FileIcon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{attachment.name || "Attachment"}</p>
          <p className="truncate text-xs opacity-65">
            {[attachment.mimeType, formatFileSize(attachment.size)].filter(Boolean).join(" · ") ||
              "File"}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => downloadAttachment(attachment)}
        className="btn btn-ghost btn-circle btn-xs"
        title="Save attachment"
        aria-label="Save attachment"
      >
        <DownloadIcon className="size-3.5" />
      </button>
    </div>
    {children}
  </div>
);

const ChatAttachment = ({ attachment }) => {
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  if (!attachment?.url) return null;

  if (attachment.type === "image") {
    return (
      <AttachmentShell attachment={attachment}>
        {isImageLoaded ? (
          <a href={attachment.url} target="_blank" rel="noreferrer">
            <img
              src={attachment.url}
              alt={attachment.name || "Attachment"}
              className="max-h-72 w-full rounded-lg object-cover"
            />
          </a>
        ) : (
          <button
            type="button"
            className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-current/20 bg-base-200/70 px-4 py-6 text-center"
            onClick={() => setIsImageLoaded(true)}
          >
            <EyeIcon className="size-5 opacity-70" />
            <span className="text-sm font-medium">Load image</span>
            <span className="max-w-xs text-xs opacity-65">
              Images stay hidden until you choose to open them.
            </span>
          </button>
        )}
      </AttachmentShell>
    );
  }

  if (attachment.type === "video") {
    return (
      <AttachmentShell attachment={attachment}>
        <video src={attachment.url} controls preload="metadata" className="max-h-72 w-full rounded-lg" />
      </AttachmentShell>
    );
  }

  if (attachment.type === "audio") {
    return (
      <AttachmentShell attachment={attachment}>
        <audio src={attachment.url} controls preload="metadata" className="w-full" />
      </AttachmentShell>
    );
  }

  return (
    <AttachmentShell attachment={attachment}>
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="btn btn-outline btn-sm w-full"
      >
        Open file
      </a>
    </AttachmentShell>
  );
};

export default ChatAttachment;
