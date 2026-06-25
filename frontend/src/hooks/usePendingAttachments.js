import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";

import { uploadChatAttachment } from "../lib/api";

const getAttachmentTypeFromFile = (file) => {
  const mimeType = file.type || "application/octet-stream";

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";

  return "file";
};

const createPendingAttachment = (file) => {
  const type = getAttachmentTypeFromFile(file);

  return {
    id: uuidv4(),
    file,
    name: file.name || "Pasted attachment",
    mimeType: file.type || "application/octet-stream",
    previewUrl: type === "image" ? URL.createObjectURL(file) : null,
    size: file.size,
    type,
  };
};

const revokePendingAttachmentPreview = (attachment) => {
  if (attachment?.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
};

const hasDraggedFiles = (event) => Array.from(event.dataTransfer?.types || []).includes("Files");

const usePendingAttachments = ({ inputRef } = {}) => {
  const pendingAttachmentsRef = useRef([]);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => {
    return () => {
      pendingAttachmentsRef.current.forEach(revokePendingAttachmentPreview);
    };
  }, []);

  const addPendingFiles = (files) => {
    if (!files.length) return;

    const nextAttachments = files.map(createPendingAttachment);
    setPendingAttachments((currentAttachments) => [...currentAttachments, ...nextAttachments]);

    toast.success(
      nextAttachments.length === 1
        ? "Attachment ready"
        : `${nextAttachments.length} attachments ready`
    );
    window.requestAnimationFrame(() => {
      inputRef?.current?.focus();
    });
  };

  const handleAttachmentSelect = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;

    try {
      addPendingFiles(selectedFiles);
    } finally {
      event.target.value = "";
    }
  };

  const handleComposerPaste = async (event) => {
    const pastedFiles = Array.from(event.clipboardData?.files || []);
    if (!pastedFiles.length) return;

    event.preventDefault();
    addPendingFiles(pastedFiles);
  };

  const handleChatDragEnter = (event) => {
    if (!hasDraggedFiles(event)) return;

    event.preventDefault();
    setIsDraggingFiles(true);
  };

  const handleChatDragOver = (event) => {
    if (!hasDraggedFiles(event)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingFiles(true);
  };

  const handleChatDragLeave = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDraggingFiles(false);
    }
  };

  const handleChatDrop = async (event) => {
    if (!hasDraggedFiles(event)) return;

    event.preventDefault();
    setIsDraggingFiles(false);

    const droppedFiles = Array.from(event.dataTransfer?.files || []);
    addPendingFiles(droppedFiles);
  };

  const handleRemovePendingAttachment = (attachmentIndex) => {
    setPendingAttachments((currentAttachments) => {
      const attachmentToRemove = currentAttachments[attachmentIndex];
      revokePendingAttachmentPreview(attachmentToRemove);
      return currentAttachments.filter((_, index) => index !== attachmentIndex);
    });
  };

  const clearPendingAttachments = () => {
    pendingAttachments.forEach(revokePendingAttachmentPreview);
    setPendingAttachments([]);
  };

  const uploadPendingAttachments = async () => {
    if (pendingAttachments.length === 0) return [];

    setIsUploadingAttachment(true);

    try {
      const uploadedAttachments = [];

      for (const pendingAttachment of pendingAttachments) {
        if (!pendingAttachment.file) {
          uploadedAttachments.push(pendingAttachment);
          continue;
        }

        const response = await uploadChatAttachment(pendingAttachment.file);
        uploadedAttachments.push(response.attachment);
      }

      return uploadedAttachments;
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  return {
    clearPendingAttachments,
    handleAttachmentSelect,
    handleChatDragEnter,
    handleChatDragLeave,
    handleChatDragOver,
    handleChatDrop,
    handleComposerPaste,
    handleRemovePendingAttachment,
    isDraggingFiles,
    isUploadingAttachment,
    pendingAttachments,
    uploadPendingAttachments,
  };
};

export default usePendingAttachments;
