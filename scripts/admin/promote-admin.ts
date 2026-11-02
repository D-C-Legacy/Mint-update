import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Standalone bootstrap script, not an HTTP endpoint on purpose — see admin_progress.md's
// "Admin bootstrap mechanism" decision: an admin-promotion route has a chicken-and-egg
// authorization problem (who's allowed to call it before any admin exists?). This needs
// exactly the DB access the team already has, just made safe and repeatable.
async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: pnpm admin:promote -- <email>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`No user found with email "${email}". They must sign up first.`);
      process.exit(1);
    }

    if (user.role === 'ADMIN') {
      console.log(`"${email}" is already an ADMIN. Nothing to do.`);
      return;
    }

    await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    console.log(`Promoted "${email}" (${user.id}) from ${user.role} to ADMIN.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
