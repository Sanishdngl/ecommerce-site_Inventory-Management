import multer from "multer";
import { logger } from "@infrastructure/observability/logger";

const SERVICE_NAME = "gateway";

export const bulkUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 200,
  },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "excel") {
      const validMimes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ];
      if (validMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        logger.warn(
          SERVICE_NAME,
          "Bulk upload rejected: invalid excel mime type",
          {
            mimetype: file.mimetype,
            originalname: file.originalname,
          }
        );
        cb(new Error("excel field must be an .xlsx file"));
      }
    } else if (file.fieldname === "images") {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        logger.warn(
          SERVICE_NAME,
          "Bulk upload rejected: invalid image mime type",
          {
            mimetype: file.mimetype,
            originalname: file.originalname,
          }
        );
        cb(new Error("images field must contain image files only"));
      }
    } else {
      logger.warn(SERVICE_NAME, "Bulk upload rejected: unexpected field", {
        fieldname: file.fieldname,
      });
      cb(new Error(`Unexpected field: ${file.fieldname}`));
    }
  },
}).fields([
  { name: "excel", maxCount: 1 },
  { name: "images", maxCount: 199 },
]);

export const singleImageUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      logger.warn(SERVICE_NAME, "Image upload rejected: invalid mime type", {
        mimetype: file.mimetype,
        originalname: file.originalname,
      });
      cb(new Error("image field must be an image file"));
    }
  },
}).single("image");
