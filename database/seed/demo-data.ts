import { BuyerType, GemOpportunityStatus, ShgType } from "@prisma/client";

/**
 * Demo/sample records for local dev and the POC demo environment — distinct
 * from the master data in data.ts (districts/categories/etc., which every
 * environment needs). Phone numbers are reserved 90000000xx test numbers.
 */

export const demoUsers: { phone: string; name: string }[] = [
  { phone: "9000000001", name: "Lakshmi Devi" },
  { phone: "9000000002", name: "Ramulu Naidu" },
  { phone: "9000000003", name: "Sita Mahalakshmi" },
];

/**
 * One demo account per official role (T09 Admin Portal) — without these,
 * nobody can log in and demo the admin portal or the officials-facing
 * dashboards in a fresh environment. District/ULB officials are scoped to
 * Anantapur specifically so their scoped views have real data to show
 * (Anantapur is the district demoShgs/demoProducts below are seeded into).
 */
export const demoOfficials: {
  phone: string;
  name: string;
  role: "ADMIN" | "STATE_OFFICIAL" | "DISTRICT_OFFICIAL" | "ULB_OFFICIAL";
  districtCode?: string;
  ulbCode?: string;
}[] = [
  { phone: "9000000010", name: "Admin User", role: "ADMIN" },
  { phone: "9000000011", name: "State Official", role: "STATE_OFFICIAL" },
  {
    phone: "9000000012",
    name: "District Official (Anantapur)",
    role: "DISTRICT_OFFICIAL",
    districtCode: "ATP",
  },
  {
    phone: "9000000013",
    name: "ULB Official (Anantapur Municipal Corporation)",
    role: "ULB_OFFICIAL",
    districtCode: "ATP",
    ulbCode: "ATP-MC",
  },
];

export const demoShgs: {
  userPhone: string;
  name: string;
  type: ShgType;
  mepmaRegistrationNumber: string;
  productionCapacityNote: string;
  districtCode: string;
  mandalCode: string;
  lat: number;
  lng: number;
}[] = [
  {
    userPhone: "9000000001",
    name: "Sri Lakshmi Pickles SHG",
    type: "FOOD",
    mepmaRegistrationNumber: "MEPMA-ATP-0001",
    productionCapacityNote: "~200 jars/month, expandable to 500 with cold storage",
    districtCode: "ATP",
    mandalCode: "ATP-M-ATP",
    lat: 14.6819,
    lng: 77.6006,
  },
  {
    userPhone: "9000000002",
    name: "Krishna Handloom Weavers SHG",
    type: "HANDLOOM",
    mepmaRegistrationNumber: "MEPMA-KRI-0002",
    productionCapacityNote: "12 looms, ~40 sarees/month",
    districtCode: "KRI",
    mandalCode: "KRI-M-GDV",
    lat: 16.4302,
    lng: 80.9989,
  },
  {
    userPhone: "9000000003",
    name: "Vizag Bamboo Craft SHG",
    type: "HANDICRAFTS",
    mepmaRegistrationNumber: "MEPMA-VSP-0003",
    productionCapacityNote: "~150 units/month across basket & diya lines",
    districtCode: "VSP",
    mandalCode: "VSP-M-AKP",
    lat: 17.6868,
    lng: 83.2185,
  },
];

export const demoProducts: {
  shgName: string;
  categorySlug: string;
  name: string;
  description: string;
  unit: string;
  price: number;
  moq: number;
  stock: number;
}[] = [
  {
    shgName: "Sri Lakshmi Pickles SHG",
    categorySlug: "pickles",
    name: "Mango Pickle (500g jar)",
    description: "Traditional Andhra-style avakaya, cold-pressed sesame oil.",
    unit: "jar",
    price: 150,
    moq: 5,
    stock: 120,
  },
  {
    shgName: "Sri Lakshmi Pickles SHG",
    categorySlug: "pickles",
    name: "Tomato Pickle (500g jar)",
    description: "Tangy tomato pickle, no preservatives.",
    unit: "jar",
    price: 120,
    moq: 5,
    stock: 90,
  },
  {
    shgName: "Krishna Handloom Weavers SHG",
    categorySlug: "ikat-textiles",
    name: "Pochampally-style Ikat Cotton Saree",
    description: "Handwoven ikat cotton saree, natural dyes.",
    unit: "piece",
    price: 1800,
    moq: 1,
    stock: 25,
  },
  {
    shgName: "Krishna Handloom Weavers SHG",
    categorySlug: "handloom-bed-linen",
    name: "Handloom Cotton Bedsheet (Double)",
    description: "Pure cotton handloom bedsheet with pillow covers.",
    unit: "set",
    price: 900,
    moq: 2,
    stock: 40,
  },
  {
    shgName: "Vizag Bamboo Craft SHG",
    categorySlug: "bamboo-craft",
    name: "Bamboo Storage Basket (Medium)",
    description: "Handwoven bamboo basket, natural finish.",
    unit: "piece",
    price: 250,
    moq: 3,
    stock: 60,
  },
  {
    shgName: "Vizag Bamboo Craft SHG",
    categorySlug: "terracotta-pottery",
    name: "Terracotta Diya Set (12 pieces)",
    description: "Hand-painted terracotta diyas, festival-ready.",
    unit: "set",
    price: 180,
    moq: 10,
    stock: 200,
  },
];

/**
 * Buyer registry demo data (T16, Module 4) — one buyer per BuyerType, each
 * interested in categories the demoProducts above actually cover, so T17's
 * recommender has real product<->buyer overlap to match against.
 * districtCode is omitted for the state-level government procurement buyer.
 */
export const demoBuyers: {
  name: string;
  type: BuyerType;
  organization?: string;
  districtCode?: string;
  categorySlugs: string[];
  demandProfile?: {
    typicalVolume?: number;
    volumeUnit?: string;
    frequency?: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEASONAL" | "ONE_OFF";
    priceBandMin?: number;
    priceBandMax?: number;
  };
  lat: number;
  lng: number;
}[] = [
  {
    name: "AP State Handicrafts Emporium",
    type: "INSTITUTIONAL",
    organization: "AP State Handicrafts Development Corporation",
    districtCode: "VSP",
    categorySlugs: ["bamboo-craft", "terracotta-pottery", "handloom-bed-linen", "ikat-textiles"],
    demandProfile: {
      typicalVolume: 200,
      volumeUnit: "pieces",
      frequency: "MONTHLY",
      priceBandMin: 150,
      priceBandMax: 2000,
    },
    lat: 17.6868,
    lng: 83.2185,
  },
  {
    name: "Vijayawada Retail Mart",
    type: "RETAIL",
    districtCode: "KRI",
    categorySlugs: ["pickles", "snacks-namkeen", "spices-masala-powders"],
    demandProfile: {
      typicalVolume: 50,
      volumeUnit: "jars",
      frequency: "WEEKLY",
      priceBandMin: 100,
      priceBandMax: 300,
    },
    lat: 16.5062,
    lng: 80.648,
  },
  {
    name: "Anantapur Wholesale Foods",
    type: "BULK",
    organization: "Anantapur Wholesale Traders Association",
    districtCode: "ATP",
    categorySlugs: ["pickles", "millet-products", "organic-vegetables"],
    demandProfile: {
      typicalVolume: 1000,
      volumeUnit: "kg",
      frequency: "MONTHLY",
      priceBandMin: 80,
      priceBandMax: 250,
    },
    lat: 14.6819,
    lng: 77.6006,
  },
  {
    name: "MEPMA Government Procurement Cell",
    type: "GOVERNMENT_PROCUREMENT",
    organization: "Ministry of Panchayat Raj & Rural Development, Government of AP",
    categorySlugs: ["pickles", "bamboo-craft", "ikat-textiles", "handloom-bed-linen"],
    demandProfile: { typicalVolume: 500, volumeUnit: "units", frequency: "QUARTERLY" },
    lat: 16.5062,
    lng: 80.648,
  },
];

/**
 * Simulated GeM procurement opportunities (T16/ADR-0025) — real GeM API
 * ingestion is T21's scope; these seed rows let the buyer registry and any
 * dashboard consuming it show real-shaped procurement demand today.
 * One entry has a past deadline + non-OPEN status for realistic variety.
 */
export const demoGemOpportunities: {
  buyerName: string;
  categorySlug?: string;
  referenceNumber: string;
  title: string;
  description: string;
  quantityRequired?: number;
  unit?: string;
  estimatedValue?: number;
  submissionDeadline: string;
  status: GemOpportunityStatus;
}[] = [
  {
    buyerName: "MEPMA Government Procurement Cell",
    categorySlug: "pickles",
    referenceNumber: "GEM/2026/B/SIM-0001",
    title: "Supply of Andhra-style pickles for Anganwadi supplementary nutrition program",
    description:
      "Bulk supply of mango/tomato pickle jars for distribution across Anantapur district Anganwadi centres.",
    quantityRequired: 5000,
    unit: "jar",
    estimatedValue: 600000,
    submissionDeadline: "2026-09-15",
    status: "OPEN",
  },
  {
    buyerName: "MEPMA Government Procurement Cell",
    categorySlug: "bamboo-craft",
    referenceNumber: "GEM/2026/B/SIM-0002",
    title: "Bamboo craft gift hampers for state government felicitation events",
    description: "Festival-season bamboo craft gift sets for official government events.",
    quantityRequired: 1000,
    unit: "piece",
    estimatedValue: 250000,
    submissionDeadline: "2026-10-20",
    status: "OPEN",
  },
  {
    buyerName: "MEPMA Government Procurement Cell",
    categorySlug: "handloom-bed-linen",
    referenceNumber: "GEM/2026/B/SIM-0003",
    title: "Handloom bed linen for government hostel welfare scheme",
    description: "Cotton bedsheets and pillow covers for SC/ST welfare hostels, Krishna district.",
    quantityRequired: 800,
    unit: "set",
    estimatedValue: 720000,
    submissionDeadline: "2026-06-30",
    status: "AWARDED",
  },
];
