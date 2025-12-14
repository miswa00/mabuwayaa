// models/Page.js
import mongoose from "mongoose";

const PageSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true }, // e.g., 'homepage', 'contact'
  data: { type: Object, default: {} }, // all your JSON content

  // ⭐ NEW FIELD — stores your uploaded PDF files
  pdfLinks: {
    type: Array,
    default: []
  }
});

export default mongoose.model("Page", PageSchema);
