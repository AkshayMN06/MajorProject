// Ops utility — sets or revokes a user's admin role by email. Never invoked
// by application code; the app has zero email-based admin logic anywhere.
// Usage: npx tsx prisma/promoteAdmin.ts <email> [USER|ADMIN]
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const role = (process.argv[3] ?? 'ADMIN').toUpperCase();

  if (!email) {
    console.error('Usage: npx tsx prisma/promoteAdmin.ts <email> [USER|ADMIN]');
    process.exit(1);
  }
  if (role !== 'USER' && role !== 'ADMIN') {
    console.error(`Invalid role "${role}" — expected USER or ADMIN.`);
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    console.error(`No user found with email "${email}".`);
    process.exit(1);
  }

  const updated = await prisma.user.update({ where: { email }, data: { role } });
  console.log(JSON.stringify({ id: updated.id, email: updated.email, name: updated.name, role: updated.role }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
