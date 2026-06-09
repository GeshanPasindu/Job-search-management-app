import fs from "node:fs";
import path from "node:path";

export type StoredFile = {
  originalFileName?: string;
  storedFileName?: string;
  filePath?: string;
  mimeType?: string;
};

export function getUploadDir() {
  const uploadDir = process.env.UPLOAD_DIR ?? "uploads";
  const absolutePath = path.isAbsolute(uploadDir)
    ? uploadDir
    : path.join(process.cwd(), uploadDir);

  fs.mkdirSync(absolutePath, { recursive: true });
  return absolutePath;
}

export function toStoredFile(file?: Express.Multer.File): StoredFile {
  if (!file) {
    return {};
  }

  return {
    originalFileName: file.originalname,
    storedFileName: file.filename,
    filePath: file.path,
    mimeType: file.mimetype
  };
}
