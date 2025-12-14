import mongoose from "mongoose";

const donationSchema = new mongoose.Schema({
  donor_name: String,
  donor_email: String,
  donation_amount: Number,
  receiptFile: String,
  uploadedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Donation", donationSchema);
