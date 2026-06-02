import multer from "multer";

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
        cb(new Error("excel field must be an .xlsx file"));
      }
    } else if (file.fieldname === "images") {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("images field must contain image files only"));
      }
    } else {
      cb(new Error(`Unexpected field: ${file.fieldname}`));
    }
  },
}).fields([
  { name: "excel", maxCount: 1 },
  { name: "images", maxCount: 199 },
]);
