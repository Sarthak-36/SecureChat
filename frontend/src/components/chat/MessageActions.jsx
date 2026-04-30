import { EllipsisVerticalIcon } from "lucide-react";
import toast from "react-hot-toast";

import ToggleDropdown from "../ToggleDropdown";

const MessageActions = ({
  canDeleteForEveryone,
  isRunningDetection,
  isRunningLinkCheck,
  message,
  onDeleteForEveryone,
  onDeleteForMe,
  onReply,
  onRunLinkCheck,
  onRunDetection,
}) => {
  const handleCopy = async () => {
    const textToCopy = message.text || message.metadata?.attachments?.[0]?.url;
    if (!textToCopy) {
      toast.error("Nothing to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success("Message copied");
    } catch {
      toast.error("Could not copy message");
    }
  };

  return (
    <ToggleDropdown
      align="right"
      contentClassName="w-44 rounded-box bg-base-200 p-2 shadow-lg"
      renderTrigger={({ toggle }) => (
        <button type="button" className="btn btn-ghost btn-circle btn-xs" onClick={toggle}>
          <EllipsisVerticalIcon className="size-4" />
        </button>
      )}
    >
      {({ close }) => (
        <ul>
          <li>
            <button
              type="button"
              className="btn btn-ghost btn-sm justify-start"
              onClick={() => {
                onReply(message);
                close();
              }}
            >
              Reply
            </button>
          </li>
          <li>
            <button
              type="button"
              className="btn btn-ghost btn-sm justify-start"
              onClick={() => {
                handleCopy();
                close();
              }}
            >
              Copy
            </button>
          </li>
          <li>
            <button
              type="button"
              className="btn btn-ghost btn-sm justify-start"
              disabled={isRunningLinkCheck}
              onClick={() => {
                onRunLinkCheck(message);
                close();
              }}
            >
              {isRunningLinkCheck ? "Checking..." : "Link Check"}
            </button>
          </li>
          <li>
            <button
              type="button"
              className="btn btn-ghost btn-sm justify-start"
              disabled={isRunningDetection}
              onClick={() => {
                onRunDetection(message);
                close();
              }}
            >
              {isRunningDetection ? "Scanning..." : "AI detection"}
            </button>
          </li>
          <li>
            <button
              type="button"
              className="btn btn-ghost btn-sm justify-start text-error/70 hover:text-error"
              onClick={() => {
                onDeleteForMe(message._id);
                close();
              }}
            >
              Delete for me
            </button>
          </li>
          {canDeleteForEveryone ? (
            <li>
              <button
                type="button"
                className="btn btn-ghost btn-sm justify-start text-error"
                onClick={() => {
                  onDeleteForEveryone(message._id);
                  close();
                }}
              >
                Delete for everyone
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </ToggleDropdown>
  );
};

export default MessageActions;
