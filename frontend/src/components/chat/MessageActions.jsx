import {
  EllipsisVerticalIcon,
  Sparkles,
  Languages,
  FileText,
  ShieldCheck,
  Link2,
  Image as ImageIcon,
  ChevronRightIcon,
  CopyIcon,
  ReplyIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  useFloating,
  flip,
  shift,
  offset,
  autoUpdate,
} from "@floating-ui/react";

const MessageActions = ({
  canDeleteForEveryone,
  isRunningDescribeImage,
  isRunningDetection,
  isRunningLinkCheck,
  isRunningSummarize,
  isRunningTranslation,
  message,
  onDeleteForEveryone,
  onDeleteForMe,
  onDescribeImage,
  onReply,
  onRunLinkCheck,
  onRunDetection,
  onSummarize,
  onTranslate,
}) => {
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPinned, setAiPinned] = useState(false);
  const containerRef = useRef(null);
  const aiCloseTimeoutRef = useRef(null);

  const { refs, floatingStyles } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-end",
    middleware: [offset(6), flip(), shift()],
    whileElementsMounted: autoUpdate,
  });

  const { refs: aiRefs, floatingStyles: aiStyles } = useFloating({
    open: aiOpen,
    onOpenChange: setAiOpen,
    placement: "right-start",
    middleware: [offset(4), flip(), shift()],
    whileElementsMounted: autoUpdate,
  });

  const hasText = Boolean(message.text?.trim());
  const hasImageAttachment = message.metadata?.attachments?.[0]?.type === "image";

  const isAnyAiRunning =
    isRunningSummarize ||
    isRunningTranslation ||
    isRunningDetection ||
    isRunningLinkCheck ||
    isRunningDescribeImage;

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
        setAiOpen(false);
        setAiPinned(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        setAiOpen(false);
        setAiPinned(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setAiOpen(false);
      setAiPinned(false);
    }
  }, [open]);

  const clearAiCloseTimeout = () => {
    if (aiCloseTimeoutRef.current) {
      clearTimeout(aiCloseTimeoutRef.current);
      aiCloseTimeoutRef.current = null;
    }
  };

  const openAiMenu = () => {
    clearAiCloseTimeout();
    setAiOpen(true);
  };

  const scheduleAiClose = () => {
    clearAiCloseTimeout();

    if (aiPinned) return;

    aiCloseTimeoutRef.current = setTimeout(() => {
      setAiOpen(false);
    }, 120);
  };

  const closeAllMenus = () => {
    clearAiCloseTimeout();
    setAiOpen(false);
    setAiPinned(false);
    setOpen(false);
  };

  const handleCopy = async () => {
    const attachmentUrls = Array.isArray(message.metadata?.attachments)
      ? message.metadata.attachments.map((attachment) => attachment.url).filter(Boolean)
      : [];
    const textToCopy = [message.text, ...attachmentUrls].filter(Boolean).join("\n");

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
    <div
      ref={containerRef}
      className={`message-actions shrink-0 ${open ? "message-actions-open" : ""}`}
    >
      <button
        ref={refs.setReference}
        onClick={() => {
          setOpen((prev) => !prev);
          setAiOpen(false);
          setAiPinned(false);
        }}
        className={`btn btn-ghost btn-circle btn-xs border border-transparent bg-base-100/60 shadow-sm backdrop-blur ${
          isAnyAiRunning ? "text-info ring-1 ring-info/30" : ""
        }`}
        title="Message actions"
        aria-label="Message actions"
      >
        {isAnyAiRunning ? <Sparkles className="size-4 animate-pulse" /> : <EllipsisVerticalIcon className="size-4" />}
      </button>

      {open ? (
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          className="z-50 w-52 rounded-xl border border-base-content/10 bg-base-100/95 p-2 shadow-xl backdrop-blur"
        >
          <ul className="space-y-1">
            <li>
              <button
                className="btn btn-ghost btn-sm w-full justify-start"
                onClick={() => {
                  onReply(message);
                  closeAllMenus();
                }}
              >
                <ReplyIcon className="mr-2 size-4" />
                Reply
              </button>
            </li>

            <li>
              <button
                className="btn btn-ghost btn-sm w-full justify-start"
                onClick={() => {
                  handleCopy();
                  closeAllMenus();
                }}
              >
                <CopyIcon className="mr-2 size-4" />
                Copy
              </button>
            </li>

            <div className="my-1 h-px bg-base-content/10" />

            <li>
              <button
                ref={aiRefs.setReference}
                className={`btn btn-ghost btn-sm w-full justify-between ${
                  isAnyAiRunning ? "bg-info/10 text-info" : ""
                }`}
                onMouseEnter={openAiMenu}
                onMouseLeave={scheduleAiClose}
                onClick={() => {
                  clearAiCloseTimeout();
                  setAiPinned((prev) => {
                    const nextPinned = !prev;
                    setAiOpen(nextPinned || !aiOpen);
                    return nextPinned;
                  });
                }}
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="size-4" />
                  Smart actions
                </span>
                <ChevronRightIcon
                  className={`size-4 transition-transform ${aiOpen ? "rotate-90" : ""}`}
                />
              </button>
            </li>

            <div className="my-1 h-px bg-base-content/10" />

            <li>
              <button
                className="btn btn-ghost btn-sm w-full justify-start text-error/70"
                onClick={() => {
                  onDeleteForMe(message._id);
                  closeAllMenus();
                }}
              >
                <Trash2Icon className="mr-2 size-4" />
                Delete for me
              </button>
            </li>

            {canDeleteForEveryone ? (
              <li>
                <button
                  className="btn btn-ghost btn-sm w-full justify-start text-error"
                  onClick={() => {
                    onDeleteForEveryone(message._id);
                    closeAllMenus();
                  }}
                >
                  <Trash2Icon className="mr-2 size-4" />
                  Delete for everyone
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {open && aiOpen ? (
        <div
          ref={aiRefs.setFloating}
          style={aiStyles}
          className="z-50 w-52 rounded-xl border border-base-content/10 bg-base-100/95 p-2 shadow-xl backdrop-blur"
          onMouseEnter={openAiMenu}
          onMouseLeave={scheduleAiClose}
        >
          <ul className="space-y-1">
            {hasText ? (
              <>
                <li>
                  <button
                    className="btn btn-ghost btn-sm w-full justify-start"
                    disabled={isAnyAiRunning}
                    onClick={() => {
                      onSummarize(message);
                      closeAllMenus();
                    }}
                  >
                    <FileText className="mr-2 size-4" />
                    {isRunningSummarize ? "Summarizing..." : "Summarize"}
                  </button>
                </li>

                <li>
                  <button
                    className="btn btn-ghost btn-sm w-full justify-start"
                    disabled={isAnyAiRunning}
                    onClick={() => {
                      onTranslate(message);
                      closeAllMenus();
                    }}
                  >
                    <Languages className="mr-2 size-4" />
                    {isRunningTranslation ? "Translating..." : "Translate"}
                  </button>
                </li>
              </>
            ) : null}

            {hasImageAttachment ? (
              <li>
                <button
                  className="btn btn-ghost btn-sm w-full justify-start"
                  disabled={isAnyAiRunning}
                  onClick={() => {
                    onDescribeImage(message);
                    closeAllMenus();
                  }}
                >
                  <ImageIcon className="mr-2 size-4" />
                  {isRunningDescribeImage ? "Describing..." : "Describe image"}
                </button>
              </li>
            ) : null}

            <li>
              <button
                className="btn btn-ghost btn-sm w-full justify-start"
                disabled={isAnyAiRunning}
                onClick={() => {
                  onRunLinkCheck(message);
                  closeAllMenus();
                }}
              >
                <Link2 className="mr-2 size-4" />
                {isRunningLinkCheck ? "Checking..." : "Link Check"}
              </button>
            </li>

            <li>
              <button
                className="btn btn-ghost btn-sm w-full justify-start"
                disabled={isAnyAiRunning}
                onClick={() => {
                  onRunDetection(message);
                  closeAllMenus();
                }}
              >
                <ShieldCheck className="mr-2 size-4" />
                {isRunningDetection ? "Scanning..." : "AI detection"}
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export default MessageActions;
