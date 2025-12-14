// app.js
import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import path from "path";
import multer from "multer";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import fs from "fs";
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

// import routes
import User from "./models/User.js";
import adminRoutesImport from "./routes/adminRoutes.js";
import frontendRoutes from "./routes/frontendRoutes.js";  

// ---------- SETUP ----------
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- LOG CONNECTION STRING ----------
console.log("Loaded MONGODB_URI:", process.env.MONGODB_URI);

// ---------- DATABASE ----------
let mongoConnected = false;
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 20000,
  })
  .then(() => {
    mongoConnected = true;
    console.log("✅ Connected to MongoDB");
  })
 .catch((err) => {
  mongoConnected = false;
  console.error("❌ MongoDB connection ERROR:");
  console.error(err.message);
});

// ---------- MULTER (Save uploads to /uploads in root) ----------

import donateRoutes from "./routes/donateRoutes.js";

app.use("/", donateRoutes);

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// ✅ Serve static folders (both /public and /uploads)
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // ✅ Ensure this line stays here

// ---------- MIDDLEWARE ----------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "cms-secret",
    resave: false,
    saveUninitialized: true,
  })
);

// ---------- AUTH MIDDLEWARE ----------
function authMiddleware(req, res, next) {
  if (!req.session.user) return res.redirect("/admin/login");
  next();
}

// ---------- LOGIN ROUTES ----------
const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "1234";

app.get("/admin/login", (req, res) => {
  res.render("admin/login");
});

app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;

  // Local login
  if (username === DEFAULT_USERNAME && password === DEFAULT_PASSWORD) {
    req.session.user = username;
    return res.redirect("/admin");
  }

  // Optional DB check if MongoDB connected
  if (mongoConnected) {
    try {
      const user = await User.findOne({ username });
      if (user && user.password === password) {
        req.session.user = username;
        return res.redirect("/admin");
      }
    } catch (err) {
      console.error("DB login check error:", err);
    }
  }

  res.send("❌ Invalid username or password. <a href='/admin/login'>Try again</a>");
});

app.get("/admin/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

// ---------- ADMIN & FRONTEND ROUTES ----------
const adminRoutes = adminRoutesImport(upload, authMiddleware);

// 🔥 FIX ADDED BELOW — do NOT remove 🔥
// Ensures /admin/volunteers ALWAYS exists even if adminRoutes.js does not define it
adminRoutes.get("/volunteers", authMiddleware, (req, res) => {
  res.render("admin/volunteers", { title: "Volunteers List" });
});
// 🔥 END FIX 🔥

app.use("/admin", adminRoutes);
app.use("/", frontendRoutes);

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).send("⚠️ Page not found.");
});

// ---------- START ----------
app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
