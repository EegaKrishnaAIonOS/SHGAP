import { ShgType } from "@prisma/client";

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
