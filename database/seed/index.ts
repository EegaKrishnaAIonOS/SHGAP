import { PrismaClient } from "@prisma/client";
import { roles, districts, ulbs, mandals, categories, festivalCalendar } from "./data";

const prisma = new PrismaClient();

async function seedRoles() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }
  console.log(`Seeded ${roles.length} roles`);
}

async function seedDistricts() {
  for (const district of districts) {
    await prisma.district.upsert({
      where: { code: district.code },
      update: { name: district.name },
      create: district,
    });
  }
  console.log(`Seeded ${districts.length} districts`);
}

async function seedUlbs() {
  const districtByCode = new Map((await prisma.district.findMany()).map((d) => [d.code, d]));
  for (const ulb of ulbs) {
    const district = districtByCode.get(ulb.districtCode);
    if (!district) throw new Error(`Unknown district code ${ulb.districtCode} for ULB ${ulb.name}`);
    await prisma.ulb.upsert({
      where: { code: ulb.code },
      update: { name: ulb.name, districtId: district.id },
      create: { name: ulb.name, code: ulb.code, districtId: district.id },
    });
  }
  console.log(`Seeded ${ulbs.length} ULBs`);
}

async function seedMandals() {
  const districtByCode = new Map((await prisma.district.findMany()).map((d) => [d.code, d]));
  for (const mandal of mandals) {
    const district = districtByCode.get(mandal.districtCode);
    if (!district) throw new Error(`Unknown district code ${mandal.districtCode} for mandal ${mandal.name}`);
    await prisma.mandal.upsert({
      where: { code: mandal.code },
      update: { name: mandal.name, districtId: district.id },
      create: { name: mandal.name, code: mandal.code, districtId: district.id },
    });
  }
  console.log(`Seeded ${mandals.length} mandals`);
}

async function seedCategories() {
  // Parents first (parentSlug === null), then children, so the FK always resolves.
  const parents = categories.filter((c) => c.parentSlug === null);
  const children = categories.filter((c) => c.parentSlug !== null);

  for (const category of parents) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: { name: category.name, slug: category.slug },
    });
  }

  const categoryBySlug = new Map((await prisma.category.findMany()).map((c) => [c.slug, c]));
  for (const category of children) {
    const parent = categoryBySlug.get(category.parentSlug!);
    if (!parent) throw new Error(`Unknown parent slug ${category.parentSlug} for category ${category.name}`);
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, parentId: parent.id },
      create: { name: category.name, slug: category.slug, parentId: parent.id },
    });
  }
  console.log(`Seeded ${categories.length} categories`);
}

async function seedFestivalCalendar() {
  for (const festival of festivalCalendar) {
    const existing = await prisma.festivalCalendar.findFirst({ where: { name: festival.name, startDate: new Date(festival.startDate) } });
    if (existing) continue;
    await prisma.festivalCalendar.create({
      data: {
        name: festival.name,
        startDate: new Date(festival.startDate),
        endDate: new Date(festival.endDate),
        recurring: festival.recurring,
        description: festival.description,
      },
    });
  }
  console.log(`Seeded ${festivalCalendar.length} festival calendar entries`);
}

async function main() {
  await seedRoles();
  await seedDistricts();
  await seedUlbs();
  await seedMandals();
  await seedCategories();
  await seedFestivalCalendar();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
