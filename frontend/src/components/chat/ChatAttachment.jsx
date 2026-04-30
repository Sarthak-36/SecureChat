const ChatAttachment = ({ attachment }) => {
  if (!attachment?.url) return null;

  if (attachment.type === "image") {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer">
        <img
          src={attachment.url}
          alt={attachment.name || "Attachment"}
          className="mt-2 max-h-72 w-full rounded-xl object-cover"
        />
      </a>
    );
  }

  if (attachment.type === "video") {
    return <video src={attachment.url} controls className="mt-2 max-h-72 w-full rounded-xl" />;
  }

  if (attachment.type === "audio") {
    return <audio src={attachment.url} controls className="mt-2 w-full" />;
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-current/20 px-3 py-2 text-sm"
    >
      <span className="truncate">{attachment.name || "Download file"}</span>
      <span className="opacity-70">Open</span>
    </a>
  );
};

export default ChatAttachment;
