/**
 * SYNTHETIC demo sales history — not real transactions. Sprint 1 (T06/T07)
 * built product registration, but no checkout/order flow exists yet, so the
 * `sales` table is genuinely empty in a fresh environment. T14's feature
 * pipeline (and T15's forecasting models, next sprint) need *some* real
 * time series to compute lag/rolling/seasonality features over — an empty
 * table produces an empty (if technically correct) feature table.
 *
 * This generates a plausible ~180-day daily-ish sales history for the
 * existing demo products, with a festival-driven demand bump (matching the
 * festival_calendar seeded in data.ts) so the resulting features aren't
 * flat. It is clearly synthetic — do not treat this as real sales data, and
 * do not run it against a production database. See ADR-0023.
 */
import { PrismaClient } from "@prisma/client";
import { festivalCalendar } from "./data";

const prisma = new PrismaClient();

const HISTORY_DAYS = 180;

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

/** How close `date` is to the nearest seeded festival window, in days (0 = inside it). */
function festivalProximity(date: Date): number {
  let closest = Infinity;
  for (const festival of festivalCalendar) {
    const start = new Date(festival.startDate);
    const end = new Date(festival.endDate);
    if (date >= start && date <= end) return 0;
    const distance = date < start ? daysBetween(start, date) : daysBetween(date, end);
    closest = Math.min(closest, Math.abs(distance));
  }
  return closest;
}

/** Deterministic pseudo-random in [0, 1) — a fixed seed keeps repeated seed runs reproducible. */
function makeRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

async function seedDemoSales() {
  const products = await prisma.product.findMany({
    include: { shg: { select: { districtId: true } } },
  });
  if (products.length === 0) {
    console.log("No products found — run the main seed first. Skipping demo sales.");
    return;
  }

  const existingCount = await prisma.sale.count();
  if (existingCount > 0) {
    console.log(`sales table already has ${existingCount} rows — skipping (not re-seeding).`);
    return;
  }

  const rng = makeRng(42);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows: {
    productId: string;
    shgId: string;
    districtId: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    saleDate: Date;
  }[] = [];

  for (const product of products) {
    const basePrice = Number(product.price);
    // Roughly how many units this product sells on an average day —
    // pickles/handicrafts move faster than a saree, reflected via unit price.
    const baseDailyUnits = basePrice > 500 ? 0.6 : basePrice > 150 ? 2.5 : 4;

    for (let i = HISTORY_DAYS; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const proximity = festivalProximity(date);
      const festivalMultiplier = proximity === 0 ? 1.8 : proximity <= 5 ? 1.3 : 1.0;
      const weekendMultiplier = [0, 6].includes(date.getDay()) ? 1.2 : 1.0;
      const noise = 0.5 + rng(); // 0.5x-1.5x day-to-day variation

      const expectedUnits = baseDailyUnits * festivalMultiplier * weekendMultiplier * noise;
      // Not every product sells every day — skip days below a small threshold,
      // same as a real intermittent-demand product would.
      if (expectedUnits < 0.4) continue;

      const quantity = Math.max(1, Math.round(expectedUnits));
      const unitPrice = Math.round(basePrice * (0.95 + rng() * 0.1)); // +/-5% price noise
      rows.push({
        productId: product.id,
        shgId: product.shgId,
        districtId: product.shg.districtId,
        quantity,
        unitPrice,
        totalAmount: quantity * unitPrice,
        saleDate: date,
      });
    }
  }

  for (const row of rows) {
    await prisma.sale.create({
      data: {
        productId: row.productId,
        shgId: row.shgId,
        districtId: row.districtId,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        totalAmount: row.totalAmount,
        saleDate: row.saleDate,
      },
    });
  }
  console.log(
    `Seeded ${rows.length} synthetic demo sale records across ${products.length} products.`,
  );
}

seedDemoSales()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
