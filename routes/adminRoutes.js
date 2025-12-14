import express from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import Page from "../models/Page.js";
import Donation from "../models/Donation.js";
import Volunteer from "../models/Volunteer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function adminRoutes(upload, authMiddleware) {
  const router = express.Router();

  // ---------- HELPERS ----------
  function stripHtml(str) {
    if (typeof str !== "string") return str;
    return str
      .replace(/<\/?[^>]+(>|$)/g, "")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .trim();
  }

  function cleanData(obj) {
    if (Array.isArray(obj)) return obj.map(cleanData);
    if (typeof obj === "object" && obj !== null) {
      const cleaned = {};
      for (const key in obj) cleaned[key] = cleanData(obj[key]);
      return cleaned;
    }
    if (typeof obj === "string") {
      let stripped = stripHtml(obj);
      try {
        const parsed = JSON.parse(stripped);
        if (typeof parsed === "object" && parsed !== null) return cleanData(parsed);
        return parsed;
      } catch {
        return stripped;
      }
    }
    return obj;
  }

  function normalizeMediaPaths(data) {
    const basePath = "/uploads/";
    function fixValue(value) {
      if (typeof value === "string") {
        if (value.startsWith("http")) return value;
        if (value.includes("uploads/")) return basePath + value.split("/").pop();
        if (/\.(jpg|jpeg|png|gif|webp|svg|mp4|mov|avi|mkv)$/i.test(value))
          return basePath + value.split("/").pop();
      }
      return value;
    }
    function deepFix(obj) {
      if (Array.isArray(obj)) return obj.map(deepFix);
      if (typeof obj === "object" && obj !== null) {
        const fixed = {};
        for (const key in obj) fixed[key] = deepFix(obj[key]);
        return fixed;
      }
      return fixValue(obj);
    }
    return deepFix(data);
  }

  // STORAGE FIX
  const uploadDir = path.join(__dirname, "../uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  if (upload && upload.storage && upload.storage.getDestination) {
    upload.storage.getDestination = (req, file, cb) => cb(null, uploadDir);
  }

  // ANY FILES
  function anyFiles(req, res, next) {
    upload.any()(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err.message);
        return res.status(500).send("Upload failed: " + err.message);
      }
      next();
    });
  }

  function saveUploadedFiles(req) {
    if (!req.files?.length) return;
    req.files.forEach((file) => {
      const targetPath = path.join(uploadDir, file.filename);
      if (!fs.existsSync(targetPath)) {
        try {
          fs.renameSync(file.path, targetPath);
        } catch (err) {
          console.error("Error moving file:", err.message);
        }
      }
    });
  }

  // ---------- ROUTES ----------

  router.get("/", authMiddleware, async (req, res) => {
    try {
      const pages = await Page.find({}, "slug");
      const allSections = pages.map((p) => ({
        name: p.slug
          .split("/")
          .pop()
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        slug: p.slug,
        type: "single",
      }));

      allSections.push({
        name: "Donations",
        slug: "donations",
        type: "list",
      });

      res.render("admin/admin-dashboard", {
        sections: allSections,
        activeSection: null,
      });
    } catch (err) {
      console.error("Dashboard Error:", err.message);
      res.status(500).send("Error loading dashboard");
    }
  });

  router.get("/edit/:slug", authMiddleware, async (req, res) => {
    try {
      const slug = req.params.slug;
      let page = await Page.findOne({ slug });
      if (!page) page = new Page({ slug, data: {} });
      res.render("admin/edit-section", {
        slug,
        section: { name: slug, slug },
        sectionData: page.data,
        index: null,
      });
    } catch (err) {
      console.error("Edit section error:", err.message);
      res.status(500).send("Error loading section");
    }
  });

  router.get("/edit/:slug/:index", authMiddleware, async (req, res) => {
    if (!/^\d+$/.test(req.params.index)) return res.status(404).send("Invalid index");
    try {
      const slug = req.params.slug;
      const index = parseInt(req.params.index);
      const page = await Page.findOne({ slug });
      const sectionData = Array.isArray(page?.data)
        ? page.data[index] || {}
        : page?.data || {};
      res.render("admin/edit-section", {
        slug,
        section: { name: slug, slug },
        sectionData,
        index,
      });
    } catch (err) {
      console.error("Edit item error:", err.message);
      res.status(500).send("Error loading item");
    }
  });

  router.post("/edit/:slug", authMiddleware, anyFiles, async (req, res) => {
    try {
      const slug = req.params.slug;
      saveUploadedFiles(req);
      let newData = normalizeMediaPaths(cleanData(req.body));

      if (req.files?.length) {
        req.files.forEach((f) => {
          const fieldName = f.fieldname.replace("_file", "");

          if (slug === "gallery" && f.mimetype.startsWith("video/")) {
            if (!newData.videos) newData.videos = [];
            newData.videos.push({
              type: "upload",
              src: `/uploads/${f.filename}`,
            });
          } else if (slug === "gallery" && f.mimetype.startsWith("image/")) {
            if (!newData.photos) newData.photos = [];
            newData.photos.push({
              type: "image",
              src: `/uploads/${f.filename}`,
            });
          } else if (f.mimetype === "application/pdf") {
            if (!newData.pdf) newData.pdf = [];
            newData.pdf.push({
              name: f.originalname,
              file: `/uploads/pdf/${f.filename}`,
            });
          } else {
            newData[fieldName] = `/uploads/${f.filename}`;
          }
        });
      }

      if (slug === "gallery" && newData.youtube_links) {
        const links = Array.isArray(newData.youtube_links)
          ? newData.youtube_links
          : [newData.youtube_links];
        if (!newData.videos) newData.videos = [];
        links.forEach((link) => {
          if (link.trim() !== "")
            newData.videos.push({ type: "youtube", embed: link.trim() });
        });
        delete newData.youtube_links;
      }

      await Page.findOneAndUpdate(
        { slug },
        { data: newData },
        { upsert: true, new: true }
      );

      console.log("Saved single section:", slug);
      res.redirect("/admin");
    } catch (err) {
      console.error("Save edit error:", err.message);
      res.status(500).send("Error saving data");
    }
  });

  router.post("/edit/:slug/:index", authMiddleware, anyFiles, async (req, res) => {
    if (!/^\d+$/.test(req.params.index)) return res.status(400).send("Invalid index");
    try {
      const slug = req.params.slug;
      const index = parseInt(req.params.index);
      saveUploadedFiles(req);
      let newData = normalizeMediaPaths(cleanData(req.body));

      if (req.files?.length) {
        req.files.forEach((f) => {
          const fieldName = f.fieldname.replace("_file", "");
          newData[fieldName] = `/uploads/${f.filename}`;
        });
      }

      let page = await Page.findOne({ slug });
      if (!page) page = new Page({ slug, data: { news: [] } });
      if (!Array.isArray(page.data.news)) page.data.news = [];

      const oldItem = page.data.news[index] || {};
      const mergedItem = { ...oldItem, ...newData };
      if (mergedItem.image_file) mergedItem.image = mergedItem.image_file;

      page.data.news[index] = mergedItem;
      await page.save();

      console.log("Saved array item:", slug, "index:", index);
      res.redirect("/admin");
    } catch (err) {
      console.error("Save item error:", err.message);
      res.status(500).send("Error saving item");
    }
  });

  // ---------- DONATION LIST ----------
  router.get("/donations", authMiddleware, async (req, res) => {
    try {
      const donations = await Donation.find().sort({ uploadedAt: -1 });
      res.render("admin/donations-list", { donations });
    } catch (err) {
      console.error("Error loading donations:", err.message);
      res.status(500).send("Error loading donations");
    }
  });

  // ---------- VOLUNTEER LIST ----------
  router.get("/volunteers", authMiddleware, async (req, res) => {
    console.log("Volunteer list route hit!");
    try {
      const volunteers = await Volunteer.find().sort({ createdAt: -1 }).lean();
      res.render("admin/volunteer-list", { volunteers });
    } catch (err) {
      console.error("Error loading volunteers:", err);
      res.status(500).send("Server error");
    }
  });

  // ---------- VOLUNTEER ADD ----------
  router.get("/volunteers/add", authMiddleware, (req, res) => {
    res.render("admin/volunteer-add");
  });

  // ---------- VOLUNTEER DELETE ----------
  router.delete("/volunteers/delete/:id", authMiddleware, async (req, res) => {
    try {
      await Volunteer.findByIdAndDelete(req.params.id);
      return res.status(200).send("Deleted");
    } catch (err) {
      console.error("Delete volunteer error:", err);
      return res.status(500).send("Error deleting volunteer");
    }
  });

  // ---------- 404 ----------
  router.use((req, res) => {
    res.status(404).send("Warning: Admin route not found.");
  });

  return router;
}
