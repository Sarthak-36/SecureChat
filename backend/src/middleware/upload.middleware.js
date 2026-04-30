import fs from "fs";
import path from "path";
import multer from "multer";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "../..");

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
};

const createUploader = ({ subdirectory, fileSize, allowedMimePrefixes = [], allowedMimeTypes = [] }) => {
  const uploadDir = ensureDir(path.join(backendRoot, "uploads", subdirectory));

  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, uploadDir);
      },
      filename: (_req, file, cb) => {
        const extension = path.extname(file.originalname);
        cb(null, `${Date.now()}-${randomUUID()}${extension}`);
      },
    }),
    limits: {
      fileSize,
    },
    fileFilter: (_req, file, cb) => {
      const isAllowed =
        allowedMimePrefixes.some((prefix) => file.mimetype.startsWith(prefix)) ||
        allowedMimeTypes.includes(file.mimetype);

      if (!isAllowed) {
        cb(new Error("Unsupported file type"));
        return;
      }

      cb(null, true);
    },
  });
};

export const uploadChatAttachment = createUploader({
  subdirectory: "chat",
  fileSize: 25 * 1024 * 1024,
  allowedMimePrefixes: ["image/", "video/", "audio/"],
  allowedMimeTypes: [
    "application/pdf",
    "application/zip",
    "application/json",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
});

export const uploadProfileImage = createUploader({
  subdirectory: "profiles",
  fileSize: 10 * 1024 * 1024,
  allowedMimePrefixes: ["image/"],
});
