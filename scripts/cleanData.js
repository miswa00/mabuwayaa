const fs = require("fs");
const path = require("path");

// ---------- CLEANING HELPERS ----------
function stripHtml(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/<\/?[^>]+(>|$)/g, "")   // remove all tags
    .replace(/&quot;/g, '"')          // decode quotes
    .replace(/&amp;/g, "&")           // decode &
    .trim();
}

function cleanData(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => cleanData(item));
  } else if (typeof obj === "object" && obj !== null) {
    const cleaned = {};
    for (const key in obj) {
      cleaned[key] = cleanData(obj[key]);
    }
    return cleaned;
  } else if (typeof obj === "string") {
    let stripped = stripHtml(obj);
    try {
      const parsed = JSON.parse(stripped);
      if (typeof parsed === "object" && parsed !== null) {
        return cleanData(parsed);
      }
      return parsed;
    } catch {
      return stripped;
    }
  }
  return obj;
}

// ---------- CLEAN ALL FILES ----------
const dataDir = path.join(__dirname, "../data");
const files = fs.readdirSync(dataDir).filter(f => f.endsWith(".json"));

files.forEach(file => {
  const filePath = path.join(dataDir, file);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const cleaned = cleanData(parsed);

    fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), "utf8");
    console.log(`✅ Cleaned: ${file}`);
  } catch (err) {
    console.error(`❌ Failed to clean ${file}:`, err.message);
  }
});
