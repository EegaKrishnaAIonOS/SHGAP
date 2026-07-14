import { RoleName } from "@prisma/client";

export const roles: { name: RoleName; description: string }[] = [
  { name: "SHG", description: "Self Help Group member / product supplier" },
  { name: "ULB_OFFICIAL", description: "Urban Local Body official — monitors SHG activity within a ULB" },
  { name: "DISTRICT_OFFICIAL", description: "District-level official — monitors SHGs, products and buyers across a district" },
  { name: "STATE_OFFICIAL", description: "State-level official (MEPMA) — monitors state-wide KPIs and district ranking" },
  { name: "ADMIN", description: "Platform administrator — manages master data, users and moderation" },
];

/** The three POC pilot districts (see Proof of Concept Scope.docx, Section 2). */
export const districts = [
  { name: "Anantapur", code: "ATP" },
  { name: "Krishna", code: "KRI" },
  { name: "Visakhapatnam", code: "VSP" },
];

export const ulbs: { name: string; code: string; districtCode: string }[] = [
  { name: "Anantapur Municipal Corporation", code: "ATP-MC", districtCode: "ATP" },
  { name: "Hindupur Municipality", code: "ATP-HND", districtCode: "ATP" },
  { name: "Tadipatri Municipality", code: "ATP-TDP", districtCode: "ATP" },

  { name: "Vijayawada Municipal Corporation", code: "KRI-VJA", districtCode: "KRI" },
  { name: "Machilipatnam Municipality", code: "KRI-MCP", districtCode: "KRI" },
  { name: "Gudivada Municipality", code: "KRI-GDV", districtCode: "KRI" },

  { name: "Greater Visakhapatnam Municipal Corporation", code: "VSP-GVMC", districtCode: "VSP" },
  { name: "Bheemunipatnam Municipality", code: "VSP-BHM", districtCode: "VSP" },
  { name: "Anakapalle Municipality", code: "VSP-AKP", districtCode: "VSP" },
];

export const mandals: { name: string; code: string; districtCode: string }[] = [
  { name: "Anantapur", code: "ATP-M-ATP", districtCode: "ATP" },
  { name: "Kalyandurg", code: "ATP-M-KYD", districtCode: "ATP" },
  { name: "Rayadurg", code: "ATP-M-RYD", districtCode: "ATP" },
  { name: "Tadipatri", code: "ATP-M-TDP", districtCode: "ATP" },
  { name: "Guntakal", code: "ATP-M-GTK", districtCode: "ATP" },

  { name: "Vijayawada Rural", code: "KRI-M-VJR", districtCode: "KRI" },
  { name: "Gudivada", code: "KRI-M-GDV", districtCode: "KRI" },
  { name: "Machilipatnam", code: "KRI-M-MCP", districtCode: "KRI" },
  { name: "Nuzvid", code: "KRI-M-NZD", districtCode: "KRI" },
  { name: "Avanigadda", code: "KRI-M-AVG", districtCode: "KRI" },

  { name: "Visakhapatnam Urban", code: "VSP-M-VUR", districtCode: "VSP" },
  { name: "Bheemunipatnam", code: "VSP-M-BHM", districtCode: "VSP" },
  { name: "Anakapalle", code: "VSP-M-AKP", districtCode: "VSP" },
  { name: "Paravada", code: "VSP-M-PRV", districtCode: "VSP" },
  { name: "Padmanabham", code: "VSP-M-PDN", districtCode: "VSP" },
];

/**
 * Product taxonomy rooted in the five product ecosystems named in the POC scope
 * (Section 2: "This provides diversity in ..."). Each parent is seeded first,
 * children reference it by slug.
 */
export const categories: { name: string; slug: string; parentSlug: string | null }[] = [
  { name: "Food Products", slug: "food-products", parentSlug: null },
  { name: "Pickles", slug: "pickles", parentSlug: "food-products" },
  { name: "Snacks & Namkeen", slug: "snacks-namkeen", parentSlug: "food-products" },
  { name: "Spices & Masala Powders", slug: "spices-masala-powders", parentSlug: "food-products" },
  { name: "Millet Products", slug: "millet-products", parentSlug: "food-products" },

  { name: "Handicrafts", slug: "handicrafts", parentSlug: null },
  { name: "Bamboo Craft", slug: "bamboo-craft", parentSlug: "handicrafts" },
  { name: "Terracotta & Pottery", slug: "terracotta-pottery", parentSlug: "handicrafts" },
  { name: "Leather Craft", slug: "leather-craft", parentSlug: "handicrafts" },
  { name: "Jute Products", slug: "jute-products", parentSlug: "handicrafts" },

  { name: "Handloom", slug: "handloom", parentSlug: null },
  { name: "Cotton Sarees", slug: "cotton-sarees", parentSlug: "handloom" },
  { name: "Ikat Textiles", slug: "ikat-textiles", parentSlug: "handloom" },
  { name: "Handloom Bed Linen", slug: "handloom-bed-linen", parentSlug: "handloom" },

  { name: "Agriculture Allied Products", slug: "agri-allied-products", parentSlug: null },
  { name: "Organic Vegetables", slug: "organic-vegetables", parentSlug: "agri-allied-products" },
  { name: "Dairy Products", slug: "dairy-products", parentSlug: "agri-allied-products" },
  { name: "Honey & Bee Products", slug: "honey-bee-products", parentSlug: "agri-allied-products" },

  { name: "Home Based Enterprises", slug: "home-based-enterprises", parentSlug: null },
  { name: "Tailoring & Garments", slug: "tailoring-garments", parentSlug: "home-based-enterprises" },
  { name: "Candle & Soap Making", slug: "candle-soap-making", parentSlug: "home-based-enterprises" },
  { name: "Papad & Vadiyalu", slug: "papad-vadiyalu", parentSlug: "home-based-enterprises" },
];

/**
 * Seed instance of each festival for the current cycle, used as regressors by the
 * forecasting pipeline (T14/T15). Dates for lunar festivals (Ugadi, Ramzan) are
 * approximate — `recurring: true` festivals must be re-confirmed against an
 * authoritative calendar and updated yearly; this seed is a representative
 * starting point for the POC, not a source of record for festival dates.
 */
export const festivalCalendar: {
  name: string;
  startDate: string;
  endDate: string;
  recurring: boolean;
  description: string;
}[] = [
  { name: "Sankranti", startDate: "2026-01-14", endDate: "2026-01-16", recurring: true, description: "Harvest festival — statewide demand peak for food products and new clothing." },
  { name: "Ugadi", startDate: "2026-03-19", endDate: "2026-03-19", recurring: true, description: "Telugu New Year — approximate date, lunar calendar; confirm annually." },
  { name: "Ganesh Chaturthi", startDate: "2026-09-14", endDate: "2026-09-14", recurring: true, description: "Vinayaka Chavithi — demand peak for clay idols/terracotta and sweets." },
  { name: "Dasara / Vijayadashami", startDate: "2026-10-20", endDate: "2026-10-20", recurring: true, description: "Approximate date, lunar calendar; confirm annually." },
  { name: "Diwali", startDate: "2026-11-08", endDate: "2026-11-08", recurring: true, description: "Approximate date, lunar calendar; confirm annually. Major demand peak across all categories." },
  { name: "Ramzan (Eid-ul-Fitr)", startDate: "2026-03-20", endDate: "2026-03-20", recurring: true, description: "Approximate date, lunar calendar; confirm annually." },
  { name: "Christmas", startDate: "2026-12-25", endDate: "2026-12-25", recurring: true, description: "Fixed date; regional demand peak in coastal AP." },
];
