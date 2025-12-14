import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/pdf");
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

function fileFilter(req, file, cb) {
  if (!file.originalname.match(/\.(pdf)$/i)) {
    return cb(new Error("Only PDF files are allowed."), false);
  }
  cb(null, true);
}

export const uploadPdf = multer({ storage, fileFilter });
