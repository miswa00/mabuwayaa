import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import Page from "./models/Page.js"; // make sure this model exists

dotenv.config();

const __dirname = path.resolve();

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("✅ Connected to MongoDB");

    const dataDir = path.join(__dirname, "data"); // your JSON folder
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith(".json"));

    for (const file of files) {
      const slug = file.replace(".json", "");
      const filePath = path.join(dataDir, file);
      const jsonData = JSON.parse(fs.readFileSync(filePath, "utf8"));

      // Upsert (update if exists, insert if not)
      await Page.findOneAndUpdate(
        { slug },
        { slug, data: jsonData },
        { upsert: true, new: true }
      );

      console.log(`📄 Imported: ${slug}`);
    }

    console.log("✅ All JSON files imported successfully!");
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  });
