import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { unflatten } from "../helpers/jsonUtils.js";
import Page from "../models/Page.js"; // MongoDB model
import multer from "multer"; // added for file upload
import Donation from "../models/Donation.js"; // added Donation model
import Volunteer from "../models/Volunteer.js"; // ✅ ADDED

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===============================
// PAGE LISTS
// ===============================
const pages = [
  "homepage",
  "mission-impact",
  "advocacy-awareness",
  "engagement-support",
  "community-stories",
  "wildlife-habitat",
  "gallery",
  "contact",
  "donate",
  "population",
  "habitat-assessment",
  "community-based",
  "scientific-publications",
  "scientific",
  "species",
  "spread-awareness",
  "volunteer"
];

const advocacyPages = [
  "habitat",
  "community-outreach",
  "scientific",
  "cepa",
  "species",
  "spread-awareness"
];

// ===============================
// CLEANING HELPERS
// ===============================
function stripHtml(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function cleanData(obj) {
  if (Array.isArray(obj)) return obj.map(item => cleanData(item));
  if (typeof obj === "object" && obj !== null) {
    const cleaned = {};
    for (const key in obj) cleaned[key] = cleanData(obj[key]);
    return cleaned;
  }
  if (typeof obj === "string") {
    let cleanedStr = stripHtml(obj);
    return cleanedStr.replace(/\s*<br\s*\/?>\s*/gi, " ");
  }
  return obj;
}

// ===============================
// DEFAULT NAVIGATION LINKS
// ===============================
const defaultNavLinks = [
  { href: "/mission-impact", text: "Mission & Impact" },
  { href: "/advocacy-awareness", text: "Advocacy & Awareness" },
  { href: "/engagement-support", text: "Engagement & Support" },
  { href: "/community-stories", text: "Community Stories" },
  { href: "/wildlife-habitat", text: "Wildlife & Habitat" }
];

// ===============================
// FETCH PAGE DATA (from MongoDB)
// ===============================
async function getPageData(slug) {
  try {
    const page = await Page.findOne({ slug });
    if (!page) return { navLinks: defaultNavLinks };

    let data = cleanData(page.data || {});
    const hasDotKey = Object.keys(data).some(k => k.includes("."));
    if (hasDotKey) data = unflatten(data);

    if (!data.navLinks) data.navLinks = defaultNavLinks;

    // ===============================
    // IMAGE PATH FIXER
    // ===============================
    const fixImagePath = (img) => {
      if (!img) return null;
      if (typeof img !== "string") return img;
      if (img.startsWith("http")) return img;

      let cleanPath = img
        .replace(/\\/g, "/")
        .replace(/^public\//, "")
        .replace(/^\/?uploads\//, "")
        .replace(/^\/+/, "");

      return `/uploads/${cleanPath}`;
    };

    // Generic image fix
    if (data.image_file || data.image) {
      const src = data.image_file || data.image;
      data.image = fixImagePath(src);
      data.image_file = fixImagePath(src);
    }

    // Hero section
    if (data.hero && typeof data.hero.image === "string") {
      data.hero.image = fixImagePath(data.hero.image);
    }

    // Media arrays
    if (data.media && Array.isArray(data.media)) {
      data.media = data.media.map(fixImagePath);
    }

    // News
    if (data.news && Array.isArray(data.news)) {
      data.news = data.news.map(item => {
        const imgSrc = item.image_file || item.image;
        if (imgSrc) {
          const fixed = fixImagePath(imgSrc);
          item.image = fixed;
          item.image_file = fixed;
        }
        if (item.media && Array.isArray(item.media)) {
          item.media = item.media.map(fixImagePath);
        }
        return item;
      });
    }

    // Homepage special handling
    if (slug === "homepage") {
      if (data.infoSection?.image_file || data.infoSection?.image) {
        const src = data.infoSection.image_file || data.infoSection.image;
        data.infoSection.image = fixImagePath(src);
        data.infoSection.image_file = fixImagePath(src);
      }

      if (data.whySave?.images?.length) {
        data.whySave.images = data.whySave.images.map(img => {
          const src = img.image_file || img.src || img.image;
          if (src) {
            const fixed = fixImagePath(src);
            img.src = fixed;
            img.image = fixed;
            img.image_file = fixed;
          }
          return img;
        });
      }
    }

    // Community-stories
    if (slug === "community-stories") {
      if (data.stories && Array.isArray(data.stories)) {
        data.stories = data.stories.map(story => {
          const src = story.image_file || story.image;
          if (src) {
            const fixed = fixImagePath(src);
            story.image = fixed;
            story.image_file = fixed;
          }
          if (story.gallery && Array.isArray(story.gallery)) {
            story.gallery = story.gallery.map(fixImagePath);
          }
          return story;
        });
      }

      if (data.media && Array.isArray(data.media)) {
        data.media = data.media.map(fixImagePath);
      }

      const newsItems = [];
      for (let i = 0; i < 10; i++) {
        const title = data[`news.${i}.title`];
        const desc = data[`news.${i}.description`];
        const rawImg =
          data[`news_${i}_image_file_file_file`] ||
          data[`news_${i}_image_file_file`] ||
          data[`news_${i}_image_file`] ||
          data[`news_${i}_image`];

        if (title || desc || rawImg) {
          newsItems.push({
            title: title || "",
            description: desc || "",
            image: fixImagePath(rawImg)
          });
        }
      }
      if (newsItems.length > 0) data.news = newsItems;
    }

    // Gallery
    if (slug === "gallery") {
      const photos = [];
      const videos = [];

      Object.keys(data).forEach(key => {
        if (key.startsWith("photos_") && key.endsWith("_src")) {
          const index = key.match(/photos_(\d+)_src/)[1];
          const altKey = `photos.${index}.alt`;
          photos.push({
            src: fixImagePath(data[key]),
            alt: data[altKey] || ""
          });
        }

        if (key.startsWith("videos_") && key.endsWith("_embed")) {
          videos.push({
            embed: data[key]
          });
        }
      });

      if (Array.isArray(data.photos)) {
        data.photos.forEach(p => {
          if (p.src) photos.push({ src: fixImagePath(p.src), alt: p.alt || "" });
        });
      }

      if (Array.isArray(data.videos)) {
        data.videos.forEach(v => {
          if (v.embed) videos.push({ embed: v.embed });
        });
      }

      if (photos.length > 0) data.photos = photos;
      if (videos.length > 0) data.videos = videos;
    }

    // ===============================
    // FIX #1 — PDF FILE SUPPORT
    // ===============================
    if (data.pdfFiles) {
      const filePath = data.pdfFiles.trim();
      if (filePath !== "") {
        data.pdf = [
          {
            name: filePath.split("/").pop(),
            file: filePath
          }
        ];
      } else {
        data.pdf = [];
      }
    }

    return data;

  } catch (err) {
    console.error(`Error fetching page ${slug}:`, err.message);
    return { navLinks: defaultNavLinks };
  }
}

// ===============================
// DONATION RECEIPT UPLOAD
// ===============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/receipts"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.post("/donate/upload-receipt", upload.single("receipt_file"), async (req, res) => {
  try {
    await Donation.create({
      donor_name: req.body.donor_name,
      donor_email: req.body.donor_email,
      donation_amount: req.body.donation_amount,
      receipt_path: `/uploads/receipts/${req.file.filename}`
    });
    res.redirect("/donate?success=1");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error uploading receipt");
  }
});

// ===============================
// ROUTES
// ===============================
pages.forEach(slug => {
  router.get(`/${slug}`, async (req, res) => {
    const data = await getPageData(slug);
    const viewPath = path.join(__dirname, `../views/frontend/${slug}.ejs`);

    if (fs.existsSync(viewPath)) {
      res.render(`frontend/${slug}`, { data, currentPath: `/${slug}` });
    } else {
      console.warn(`Template not found for ${slug}, falling back to homepage`);
      const homeData = await getPageData("homepage");
      res.render("frontend/homepage", { data: homeData, currentPath: "/" });
    }
  });
});

// Volunteer GET
router.get("/volunteer", async (req, res) => {
  const data = await getPageData("volunteer");
  const viewPath = path.join(__dirname, "../views/frontend/volunteer.ejs");

  if (fs.existsSync(viewPath)) {
    res.render("frontend/volunteer", { data, currentPath: "/volunteer" });
  } else {
    console.warn("Template not found for volunteer, falling back to homepage");
    const homeData = await getPageData("homepage");
    res.render("frontend/homepage", { data: homeData, currentPath: "/" });
  }
});

// =============================================
// ✅ VOLUNTEER FORM SUBMISSION (ADDED SAFELY)
// =============================================
router.post("/volunteer", async (req, res) => {
  try {
    await Volunteer.create({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      phone: req.body.phone,
      age: req.body.age,
      location: req.body.location,
      skills: req.body.skills,
      interests: Array.isArray(req.body.interests)
        ? req.body.interests
        : [req.body.interests].filter(Boolean),
      availability: req.body.availability
    });

    res.redirect("/volunteer?success=1");
  } catch (err) {
    console.error(err);
    res.redirect("/volunteer?error=1");
  }
});

// Advocacy routes
advocacyPages.forEach(slug => {
  router.get(`/advocacy-awareness/${slug}`, async (req, res) => {
    const data = await getPageData(slug);
    const viewPath = path.join(__dirname, `../views/frontend/${slug}.ejs`);

    if (fs.existsSync(viewPath)) {
      res.render(`frontend/${slug}`, { data, currentPath: `/advocacy-awareness/${slug}` });
    } else {
      console.warn(`Template not found for advocacy/${slug}, falling back`);
      const homeData = await getPageData("homepage");
      res.render("frontend/homepage", { data: homeData, currentPath: "/" });
    }
  });
});

// Short redirects
["habitat", "community-outreach", "scientific", "cepa", "species", "spread-awareness"].forEach(slug => {
  router.get(`/${slug}`, (req, res) => {
    res.redirect(`/advocacy-awareness/${slug}`);
  });
});

// Homepage route
router.get("/", async (req, res) => {
  const data = await getPageData("homepage");
  const viewPath = path.join(__dirname, "../views/frontend/homepage.ejs");

  if (fs.existsSync(viewPath)) {
    res.render("frontend/homepage", { data, currentPath: "/" });
  } else {
    console.warn("Template not found for homepage, falling back");
    res.render("frontend/index", { data, currentPath: "/" });
  }
});

export default router;
