import { PrismaClient } from '@prisma/client';
import { generateId } from '../src/shared/ids/id';

// Starter taxonomy — no doc anywhere gives a real category list (00-PRD.md only says
// "Inventory and categories" with no names), so this is a reasonable, generic placeholder
// tree for a live-shopping platform, not sourced from any spec. Revise freely; nothing in
// the domain logic depends on these exact names or slugs.
const CATEGORY_TREE: ReadonlyArray<{ slug: string; name: string; children?: ReadonlyArray<{ slug: string; name: string }> }> = [
  {
    slug: 'fashion-accessories',
    name: 'Fashion & Accessories',
    children: [
      { slug: 'womens-clothing', name: "Women's Clothing" },
      { slug: 'mens-clothing', name: "Men's Clothing" },
      { slug: 'jewelry-watches', name: 'Jewelry & Watches' },
    ],
  },
  {
    slug: 'electronics',
    name: 'Electronics',
    children: [
      { slug: 'phones-tablets', name: 'Phones & Tablets' },
      { slug: 'computers-accessories', name: 'Computers & Accessories' },
    ],
  },
  {
    slug: 'home-living',
    name: 'Home & Living',
    children: [
      { slug: 'kitchen-dining', name: 'Kitchen & Dining' },
      { slug: 'decor', name: 'Decor' },
    ],
  },
  {
    slug: 'beauty-personal-care',
    name: 'Beauty & Personal Care',
    children: [
      { slug: 'skincare', name: 'Skincare' },
      { slug: 'makeup', name: 'Makeup' },
    ],
  },
  {
    slug: 'collectibles-toys',
    name: 'Collectibles & Toys',
    children: [
      { slug: 'trading-cards', name: 'Trading Cards' },
      { slug: 'action-figures', name: 'Action Figures' },
    ],
  },
  {
    slug: 'sports-outdoors',
    name: 'Sports & Outdoors',
    children: [{ slug: 'fitness-equipment', name: 'Fitness Equipment' }],
  },
];

async function upsertCategory(
  prisma: PrismaClient,
  slug: string,
  name: string,
  position: number,
  parentId: string | null,
): Promise<string> {
  const row = await prisma.category.upsert({
    where: { slug },
    update: { name, position, parentId },
    create: { id: generateId(), slug, name, position, parentId },
  });
  return row.id;
}

// The platform-wide ledger accounts (ownerId: null) — one per non-seller-scoped
// LedgerAccountType (03-DATA-MODEL.md §10). SELLER_PENDING/SELLER_AVAILABLE/SELLER_PAID_OUT
// are owner-scoped per seller and created on demand, not seeded here.
const PLATFORM_LEDGER_ACCOUNT_TYPES = [
  'PLATFORM_CASH',
  'PLATFORM_REVENUE',
  'PROCESSOR_FEES',
  'REFUNDS_PAYABLE',
] as const;

async function seedLedgerAccounts(prisma: PrismaClient): Promise<void> {
  // Prisma's generated WhereUniqueInput for a compound index can't carry `null` for a
  // nullable member field, so a plain upsert() isn't usable here — find-then-create instead.
  for (const type of PLATFORM_LEDGER_ACCOUNT_TYPES) {
    const existing = await prisma.ledgerAccount.findFirst({ where: { type, ownerId: null, currency: 'USD' } });
    if (!existing) {
      await prisma.ledgerAccount.create({ data: { id: generateId(), type, ownerId: null, currency: 'USD' } });
    }
  }

  const count = await prisma.ledgerAccount.count();
  console.log(`Seeded ledger accounts. Total rows: ${count}`);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  let position = 0;
  for (const top of CATEGORY_TREE) {
    const parentId = await upsertCategory(prisma, top.slug, top.name, position, null);
    position += 1;

    let childPosition = 0;
    for (const child of top.children ?? []) {
      await upsertCategory(prisma, child.slug, child.name, childPosition, parentId);
      childPosition += 1;
    }
  }

  const count = await prisma.category.count();
  console.log(`Seeded categories. Total rows: ${count}`);

  await seedLedgerAccounts(prisma);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
