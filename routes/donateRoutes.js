import express from "express";
import multer from "multer";
import path from "path";
import Donation from "../models/Donation.js";

const router = express.Router();

// 📁 Storage setup for uploaded receipts
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/receipts/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// ✅ Handle receipt upload
router.post("/donate/upload-receipt", upload.single("receipt_file"), async (req, res) => {
  try {
    const { donor_name, donor_email, donation_amount } = req.body;
    const receiptFile = req.file ? `/uploads/receipts/${req.file.filename}` : null;

    const newDonation = new Donation({
      donor_name,
      donor_email,
      donation_amount,
      receiptFile,
      uploadedAt: new Date(),
    });
    await newDonation.save();

    res.redirect("/donate?success=1"); // redirect back with success flag
  } catch (err) {
    console.error("❌ Error uploading receipt:", err);
    res.status(500).send("Something went wrong. Please try again later.");
  }
});

export default router;
