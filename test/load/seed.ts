// Fixture seeder for the k6 scripts in this directory (06-REALTIME-AND-CONCURRENCY.md §12).
//
// Run once before any scenario: `npx ts-node test/load/seed.ts`. Writes
// `test/load/.output/fixtures.json` (gitignored — holds real signed JWTs) with a pool of buyer
// users and N "rooms" (seller + channel + a LIVE stream session + an OPEN auction sale each),
// which every scenario script reads via k6's `open()`.
//
// Deliberately plain `PrismaClient` + `generateId()`, same shape as `prisma/seed.ts` — not a
// NestFactory application context. Two things are hand-written to the schema directly rather
// than run through the real use cases, and that is a deliberate scope choice, not a shortcut:
//   - Seller approval skips `SellersService`'s saveDraft/submit/approve chain. Nothing about
//     that chain's own business rules is what this load test is exercising, and looping it for
//     thousands of rooms over real HTTP/service calls would make seeding itself the bottleneck.
//   - The stream session goes straight to status LIVE, never through `StartSessionUseCase`,
//     because that use case calls the real `StreamProviderPort` (LiveKit/IVS) to create an
//     actual video room — orthogonal to this ticket, which is load-testing Socket.IO bid/chat/
//     presence fanout, not video. No LiveKit credentials are assumed to exist anywhere here.
// The auction Sale IS what these scenarios exist to hammer, so its shape matches exactly what
// `CreateSaleUseCase` (P5-09) would have written — just inserted directly, and its BullMQ
// auction-close job deliberately NOT scheduled (endsAt is hours out; nothing here needs the
// real close job to ever fire mid-test).
import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { generateId } from '../../src/shared/ids/id';
import { JwtService } from '../../src/platform/auth/jwt.service';

const ROOMS = Number(process.env.LOAD_TEST_ROOMS ?? 3);
const BUYERS = Number(process.env.LOAD_TEST_BUYERS ?? 50);
const AUCTION_DURATION_SECONDS = Number(process.env.LOAD_TEST_AUCTION_SECONDS ?? 7200);
const START_AMOUNT = 1000n; // $10.00 in minor units — arbitrary, matches no real listing

const OUTPUT_DIR = join(__dirname, '.output');
const OUTPUT_FILE = join(OUTPUT_DIR, 'fixtures.json');

interface RoomFixture {
  readonly sessionId: string;
  readonly saleId: string;
  readonly sellerUserId: string;
  readonly sellerToken: string;
}

interface BuyerFixture {
  readonly userId: string;
  readonly token: string;
}

async function seedBuyers(prisma: PrismaClient, jwt: JwtService, count: number): Promise<BuyerFixture[]> {
  const emails = Array.from({ length: count }, (_, i) => `loadtest-buyer-${i}@test.local`);

  await prisma.user.createMany({
    skipDuplicates: true,
    data: emails.map((email, i) => ({
      id: generateId(),
      email,
      passwordHash: 'LOAD_TEST_FIXTURE_NO_LOGIN',
      displayName: `Load Test Buyer ${i}`,
      role: 'BUYER' as const,
      status: 'ACTIVE' as const,
      emailVerifiedAt: new Date(),
    })),
  });

  const rows = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  return rows.map((row) => ({ userId: row.id, token: jwt.signAccessToken({ sub: row.id, role: 'BUYER' }) }));
}

async function seedRoom(prisma: PrismaClient, jwt: JwtService, index: number): Promise<RoomFixture> {
  const email = `loadtest-seller-${index}@test.local`;

  const sellerUser = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      id: generateId(),
      email,
      passwordHash: 'LOAD_TEST_FIXTURE_NO_LOGIN',
      displayName: `Load Test Seller ${index}`,
      role: 'SELLER',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  const seller = await prisma.seller.upsert({
    where: { userId: sellerUser.id },
    update: { status: 'APPROVED', approvedAt: new Date(), approvedByUserId: 'loadtest-admin' },
    create: {
      id: generateId(),
      userId: sellerUser.id,
      type: 'INDIVIDUAL',
      legalName: `Load Test Seller ${index} Legal`,
      displayName: `Load Test Seller ${index}`,
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedByUserId: 'loadtest-admin',
    },
  });

  // Not read anywhere in this ticket's scenarios, but kept consistent with the real shape a
  // genuinely-approved seller would have (SellerApplication is 1:1 with Seller, decision-tracked).
  await prisma.sellerApplication.upsert({
    where: { sellerId: seller.id },
    update: { decision: 'APPROVED', reviewedAt: new Date(), reviewedByUserId: 'loadtest-admin' },
    create: {
      id: generateId(),
      sellerId: seller.id,
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedByUserId: 'loadtest-admin',
      decision: 'APPROVED',
      formData: {},
    },
  });

  const channel = await prisma.channel.upsert({
    where: { sellerId: seller.id },
    update: {},
    create: {
      id: generateId(),
      sellerId: seller.id,
      slug: `loadtest-room-${index}`,
      name: `Load Test Room ${index}`,
    },
  });

  const category = await prisma.category.findFirst({ where: { parentId: { not: null } } });
  if (!category) {
    throw new Error('No category found — run `pnpm db:seed` (prisma/seed.ts) before seeding load-test fixtures.');
  }

  const product = await prisma.product.create({
    data: {
      id: generateId(),
      sellerId: seller.id,
      categoryId: category.id,
      title: `Load Test Lot ${index}`,
      condition: 'NEW',
      status: 'ACTIVE',
      quantity: 1,
      reserved: 1,
    },
  });

  // Reused across reseeds of the same room index: if a prior run's session/sale still exist,
  // leave them — a fresh LIVE session + OPEN sale is cheap enough to just always create new.
  const session = await prisma.streamSession.create({
    data: {
      id: generateId(),
      channelId: channel.id,
      title: `Load Test Stream ${index}`,
      status: 'LIVE',
      startedAt: new Date(),
    },
  });

  const endsAt = new Date(Date.now() + AUCTION_DURATION_SECONDS * 1000);
  const sale = await prisma.sale.create({
    data: {
      id: generateId(),
      sessionId: session.id,
      sellerId: seller.id,
      productId: product.id,
      mode: 'AUCTION',
      status: 'OPEN',
      currency: 'USD',
      startAmount: START_AMOUNT,
      endsAt,
    },
  });

  return {
    sessionId: session.id,
    saleId: sale.id,
    sellerUserId: sellerUser.id,
    sellerToken: jwt.signAccessToken({ sub: sellerUser.id, role: 'SELLER' }),
  };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const jwt = new JwtService();

  console.log(`Seeding ${BUYERS} buyers and ${ROOMS} rooms (auction duration ${AUCTION_DURATION_SECONDS}s)...`);

  const buyers = await seedBuyers(prisma, jwt, BUYERS);

  const rooms: RoomFixture[] = [];
  for (let i = 0; i < ROOMS; i++) {
    rooms.push(await seedRoom(prisma, jwt, i));
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify({ buyers, rooms }, null, 2));

  console.log(`Wrote ${buyers.length} buyers and ${rooms.length} rooms to ${OUTPUT_FILE}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
