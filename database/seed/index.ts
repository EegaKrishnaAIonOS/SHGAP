import { PrismaClient } from "@prisma/client";
import { roles, districts, ulbs, mandals, categories, festivalCalendar } from "./data";
import { demoUsers, demoShgs, demoProducts } from "./demo-data";

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
    if (!district)
      throw new Error(`Unknown district code ${mandal.districtCode} for mandal ${mandal.name}`);
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
    if (!parent)
      throw new Error(`Unknown parent slug ${category.parentSlug} for category ${category.name}`);
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
    const existing = await prisma.festivalCalendar.findFirst({
      where: { name: festival.name, startDate: new Date(festival.startDate) },
    });
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

async function seedDemoShgsAndProducts() {
  const shgRole = await prisma.role.findUnique({ where: { name: "SHG" } });
  if (!shgRole) throw new Error("SHG role not seeded — run seedRoles first");

  const userByPhone = new Map<string, { id: string }>();
  for (const user of demoUsers) {
    const record = await prisma.user.upsert({
      where: { phone: user.phone },
      update: { name: user.name, status: "ACTIVE" },
      create: { phone: user.phone, name: user.name, status: "ACTIVE" },
    });
    userByPhone.set(user.phone, record);

    const existingRole = await prisma.userRole.findFirst({
      where: { userId: record.id, roleId: shgRole.id },
    });
    if (!existingRole) {
      await prisma.userRole.create({ data: { userId: record.id, roleId: shgRole.id } });
    }
  }

  const districtByCode = new Map((await prisma.district.findMany()).map((d) => [d.code, d]));
  const mandalByCode = new Map((await prisma.mandal.findMany()).map((m) => [m.code, m]));
  const shgByName = new Map<string, { id: string }>();

  for (const shg of demoShgs) {
    const contactUser = userByPhone.get(shg.userPhone);
    const district = districtByCode.get(shg.districtCode);
    const mandal = mandalByCode.get(shg.mandalCode);
    if (!contactUser || !district || !mandal) {
      throw new Error(`Missing reference data for demo SHG "${shg.name}"`);
    }

    const record = await prisma.shg.upsert({
      where: { mepmaRegistrationNumber: shg.mepmaRegistrationNumber },
      update: {
        name: shg.name,
        type: shg.type,
        productionCapacityNote: shg.productionCapacityNote,
        districtId: district.id,
        mandalId: mandal.id,
        contactUserId: contactUser.id,
      },
      create: {
        name: shg.name,
        type: shg.type,
        mepmaRegistrationNumber: shg.mepmaRegistrationNumber,
        productionCapacityNote: shg.productionCapacityNote,
        districtId: district.id,
        mandalId: mandal.id,
        contactUserId: contactUser.id,
      },
    });
    shgByName.set(shg.name, record);

    await prisma.$executeRaw`
      UPDATE shg SET location = ST_SetSRID(ST_MakePoint(${shg.lng}, ${shg.lat}), 4326)
      WHERE id = ${record.id}::uuid
    `;
  }
  console.log(`Seeded ${demoUsers.length} demo users + ${demoShgs.length} demo SHGs`);

  const categoryBySlug = new Map((await prisma.category.findMany()).map((c) => [c.slug, c]));

  for (const product of demoProducts) {
    const shg = shgByName.get(product.shgName);
    const category = categoryBySlug.get(product.categorySlug);
    if (!shg || !category) {
      throw new Error(`Missing reference data for demo product "${product.name}"`);
    }

    const existing = await prisma.product.findFirst({
      where: { shgId: shg.id, name: product.name },
    });
    const record = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: {
            categoryId: category.id,
            description: product.description,
            unit: product.unit,
            price: product.price,
            moq: product.moq,
            stock: product.stock,
          },
        })
      : await prisma.product.create({
          data: {
            shgId: shg.id,
            categoryId: category.id,
            name: product.name,
            description: product.description,
            unit: product.unit,
            price: product.price,
            moq: product.moq,
            stock: product.stock,
          },
        });

    // Products inherit their parent SHG's location for this demo dataset.
    await prisma.$executeRaw`
      UPDATE products SET location = (SELECT location FROM shg WHERE id = ${shg.id}::uuid)
      WHERE id = ${record.id}::uuid
    `;
  }
  console.log(`Seeded ${demoProducts.length} demo products`);
}

async function main() {
  await seedRoles();
  await seedDistricts();
  await seedUlbs();
  await seedMandals();
  await seedCategories();
  await seedFestivalCalendar();
  await seedDemoShgsAndProducts();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
