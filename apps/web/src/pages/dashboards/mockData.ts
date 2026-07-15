/**
 * Placeholder data shared across the Module-5/Module-7 dashboard
 * wireframes. Every dashboard page below imports from here instead of
 * calling an API — real data wiring lands in T06+ once the core-api
 * endpoints exist. Keeping it in one module makes the numbers at least
 * internally consistent across screens (e.g. district sales roughly sum to
 * the state total shown on the government dashboard).
 */

export const monthlySalesTrend = [
  { month: "Feb", sales: 420000, orders: 980 },
  { month: "Mar", sales: 465000, orders: 1050 },
  { month: "Apr", sales: 510000, orders: 1190 },
  { month: "May", sales: 498000, orders: 1140 },
  { month: "Jun", sales: 560000, orders: 1260 },
  { month: "Jul", sales: 612000, orders: 1340 },
];

export const categoryBreakdown = [
  { category: "Spices", value: 32 },
  { category: "Handicrafts", value: 26 },
  { category: "Textiles", value: 24 },
  { category: "Food", value: 18 },
];

export const districts = [
  { id: "d1", name: "Guntur", ulbs: 12, shgs: 340, members: 4120, sales: 1850000, growth: "+8.2%" },
  { id: "d2", name: "Krishna", ulbs: 9, shgs: 275, members: 3305, sales: 1420000, growth: "+5.1%" },
  {
    id: "d3",
    name: "Visakhapatnam",
    ulbs: 14,
    shgs: 410,
    members: 4890,
    sales: 2210000,
    growth: "+11.4%",
  },
  {
    id: "d4",
    name: "Chittoor",
    ulbs: 10,
    shgs: 298,
    members: 3540,
    sales: 1590000,
    growth: "+3.6%",
  },
  { id: "d5", name: "Nellore", ulbs: 7, shgs: 190, members: 2260, sales: 980000, growth: "-1.2%" },
];

export const ulbs = [
  {
    id: "u1",
    name: "Guntur Municipal Corporation",
    district: "Guntur",
    shgs: 96,
    members: 1180,
    sales: 610000,
  },
  {
    id: "u2",
    name: "Tenali Municipality",
    district: "Guntur",
    shgs: 54,
    members: 640,
    sales: 320000,
  },
  {
    id: "u3",
    name: "Vijayawada Municipal Corporation",
    district: "Krishna",
    shgs: 120,
    members: 1450,
    sales: 780000,
  },
  {
    id: "u4",
    name: "Machilipatnam Municipality",
    district: "Krishna",
    shgs: 48,
    members: 560,
    sales: 260000,
  },
  {
    id: "u5",
    name: "Visakhapatnam Municipal Corporation",
    district: "Visakhapatnam",
    shgs: 150,
    members: 1820,
    sales: 950000,
  },
];

export const shgs = [
  {
    id: "s1",
    name: "Jyothi SHG",
    ulb: "Guntur Municipal Corporation",
    members: 12,
    products: 8,
    sales: 84000,
    status: "active" as const,
  },
  {
    id: "s2",
    name: "Sneha SHG",
    ulb: "Tenali Municipality",
    members: 10,
    products: 6,
    sales: 61500,
    status: "active" as const,
  },
  {
    id: "s3",
    name: "Lakshmi SHG",
    ulb: "Vijayawada Municipal Corporation",
    members: 15,
    products: 11,
    sales: 112000,
    status: "active" as const,
  },
  {
    id: "s4",
    name: "Durga SHG",
    ulb: "Machilipatnam Municipality",
    members: 8,
    products: 5,
    sales: 38500,
    status: "pending" as const,
  },
  {
    id: "s5",
    name: "Saraswathi SHG",
    ulb: "Visakhapatnam Municipal Corporation",
    members: 11,
    products: 9,
    sales: 95200,
    status: "active" as const,
  },
];

export const products = [
  {
    id: "p1",
    name: "Turmeric Powder (500g)",
    category: "Spices",
    shg: "Jyothi SHG",
    price: 120,
    unitsSold: 640,
  },
  {
    id: "p2",
    name: "Palm Leaf Basket",
    category: "Handicrafts",
    shg: "Sneha SHG",
    price: 250,
    unitsSold: 210,
  },
  {
    id: "p3",
    name: "Cotton Handloom Saree",
    category: "Textiles",
    shg: "Lakshmi SHG",
    price: 1400,
    unitsSold: 95,
  },
  {
    id: "p4",
    name: "Millet Snack Mix (250g)",
    category: "Food",
    shg: "Jyothi SHG",
    price: 90,
    unitsSold: 480,
  },
  {
    id: "p5",
    name: "Bamboo Craft Lamp",
    category: "Handicrafts",
    shg: "Sneha SHG",
    price: 550,
    unitsSold: 130,
  },
  {
    id: "p6",
    name: "Red Chilli Powder (500g)",
    category: "Spices",
    shg: "Lakshmi SHG",
    price: 140,
    unitsSold: 520,
  },
];

export const buyers = [
  { id: "b1", name: "Amaravati Retail Pvt Ltd", type: "Retailer", orders: 42, totalSpend: 610000 },
  { id: "b2", name: "GoGreen Exports", type: "Exporter", orders: 18, totalSpend: 890000 },
  { id: "b3", name: "Anjali Kirana Store", type: "Retailer", orders: 65, totalSpend: 275000 },
  {
    id: "b4",
    name: "State Handicrafts Emporium",
    type: "Institutional",
    orders: 9,
    totalSpend: 420000,
  },
  { id: "b5", name: "Rani (individual buyer)", type: "Individual", orders: 6, totalSpend: 8200 },
];

export const districtComparison = districts.map((d) => ({
  district: d.name,
  sales: d.sales,
  members: d.members,
}));
