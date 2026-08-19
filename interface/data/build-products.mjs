// Converts datum/product_catalog/ap_shg_product_details.xlsx into the JSON
// catalog the static interface/ prototype fetches at runtime (interface.html
// pages have no build step, so this is a checked-in generation step rather
// than something run automatically). Re-run with:
//   node interface/data/build-products.mjs
//
// The xlsx's "Images (JSON)" column holds links to pages that *show* the
// product (IndiaMART listings, news articles, YouTube videos) rather than
// direct image files, so each candidate URL is resolved to a real photo by
// fetching the page and reading its og:image/twitter:image meta tag (or the
// first plausible <img> as a last resort). Resolved URLs are cached in
// image-cache.json, keyed by source URL, so re-runs don't re-fetch the web.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const xlsxPath = path.join(repoRoot, "datum/product_catalog/ap_shg_product_details.xlsx");
const outPath = path.join(__dirname, "products.json");
const cachePath = path.join(__dirname, "image-cache.json");

const workbook = XLSX.read(readFileSync(xlsxPath));
const sheet = workbook.Sheets["product_details"];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

function slugify(name, seen) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  let slug = base;
  let n = 2;
  while (seen.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  seen.add(slug);
  return slug;
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function extractYoutubeId(url) {
  const match = /[?&]v=([^&]+)/.exec(url) ?? /youtu\.be\/([^?&]+)/.exec(url);
  return match ? match[1] : null;
}

const IMAGE_FILE_PATTERN = /\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i;
const NON_PRODUCT_IMG_PATTERN = /logo|icon|sprite|avatar|badge|pixel|tracking|banner-ad/i;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function toAbsolute(url, base) {
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

function extractMetaImage(html, base) {
  const metaPattern = /<meta\s+[^>]*>/gi;
  for (const tag of html.match(metaPattern) ?? []) {
    const isOg = /property\s*=\s*["']og:image["']/i.test(tag) || /name\s*=\s*["']twitter:image["']/i.test(tag);
    if (!isOg) continue;
    const content = /content\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (content) return toAbsolute(content[1], base);
  }
  return null;
}

function extractFirstContentImage(html, base) {
  const imgPattern = /<img\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgPattern.exec(html))) {
    const src = match[1];
    if (NON_PRODUCT_IMG_PATTERN.test(src)) continue;
    if (!IMAGE_FILE_PATTERN.test(src.split("?")[0])) continue;
    const absolute = toAbsolute(src, base);
    if (absolute) return absolute;
  }
  return null;
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Resolves one catalog-page URL to a real, directly-embeddable image URL (or null). */
async function resolveOne(url) {
  if (IMAGE_FILE_PATTERN.test(url.split("?")[0])) return url;

  const youtubeId = extractYoutubeId(url);
  if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

  try {
    const response = await fetchWithTimeout(url, 8000);
    if (!response.ok) return null;
    const html = await response.text();
    return extractMetaImage(html, response.url) ?? extractFirstContentImage(html, response.url);
  } catch {
    return null;
  }
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function resolveImageCache(candidateUrls) {
  const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
  const uncached = candidateUrls.filter((url) => !(url in cache));

  console.log(`Resolving ${uncached.length} uncached image URLs (${candidateUrls.length - uncached.length} cached)...`);
  const resolved = await mapWithConcurrency(uncached, 8, async (url, index) => {
    const result = await resolveOne(url);
    if ((index + 1) % 20 === 0) console.log(`  ...${index + 1}/${uncached.length}`);
    return result;
  });
  uncached.forEach((url, i) => {
    cache[url] = resolved[i];
  });

  writeFileSync(cachePath, JSON.stringify(cache, null, 2) + "\n");
  return cache;
}

const seenSlugs = new Set();
const rawProducts = rows.map((row) => {
  const rawMaterials = parseJsonArray(row["Raw Materials (JSON)"]).map((m) => ({
    material: m.material ?? "",
    cost: m.cost ?? "",
  }));
  const imageCandidates = parseJsonArray(row["Images (JSON)"]);
  // Not a 1:1 mapping with rawMaterials (different array lengths in the
  // source data) — these are just representative photos of "raw materials
  // used" for the product generally, not per-material images.
  const rawMaterialImageCandidates = parseJsonArray(row["Raw Material Images (JSON)"]);
  const videoUrls = parseJsonArray(row["Making Videos (JSON)"]);
  const videoId = videoUrls.map(extractYoutubeId).find(Boolean) ?? null;

  return {
    id: slugify(row["Product Name"], seenSlugs),
    name: row["Product Name"],
    category: row["Category"],
    description: row["Description"],
    price: row["Price (INR)"],
    orders: row["Orders"],
    season: row["Season (Peak Demand)"],
    insight: row["Insights"],
    availability: row["Availability (Districts)"],
    rawMaterials,
    imageCandidates,
    rawMaterialImageCandidates,
    videoId,
  };
});

const allCandidateUrls = [
  ...new Set(rawProducts.flatMap((p) => [...p.imageCandidates, ...p.rawMaterialImageCandidates])),
];
const imageCache = await resolveImageCache(allCandidateUrls);

// Some source pages (e.g. a Wikipedia article used as a stand-in product
// link) resolve to a diagram/icon rather than an actual photo — real product
// photos are essentially never SVG-derived, so drop those regardless of
// category. Matches both a plain "foo.svg" and Wikimedia's thumbnail
// rendering path (".../Foo.svg/1280px-Foo.svg.png"), which still contains
// ".svg" as a path segment even though the final extension is .png.
const isDiagram = (url) => /\.svg([/.]|$)/i.test(url);

function resolveCandidates(candidates) {
  return [...new Set(candidates.map((url) => imageCache[url]).filter(Boolean))]
    .filter((url) => !isDiagram(url))
    .slice(0, 3);
}

const products = rawProducts.map(({ imageCandidates, rawMaterialImageCandidates, ...product }) => ({
  ...product,
  images: resolveCandidates(imageCandidates),
  rawMaterialImages: resolveCandidates(rawMaterialImageCandidates),
}));

writeFileSync(outPath, JSON.stringify(products, null, 2) + "\n");
const withImages = products.filter((p) => p.images.length > 0).length;
console.log(`Wrote ${products.length} products to ${path.relative(repoRoot, outPath)} (${withImages} with resolved images)`);
