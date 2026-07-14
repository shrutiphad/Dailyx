// Seed a demo account so the app is clickable immediately after `pnpm db:seed`.
// Login: demo@dailyx.app / password123
import bcrypt from 'bcryptjs';
import { prisma } from './index';

async function main() {
  const account = await prisma.account.upsert({
    where: { id: 'seed-account' },
    update: {},
    create: { id: 'seed-account', name: 'Acme Co' },
  });

  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.user.upsert({
    where: { email: 'demo@dailyx.app' },
    update: { passwordHash },
    create: {
      accountId: account.id,
      email: 'demo@dailyx.app',
      name: 'Demo User',
      passwordHash,
    },
  });

  // A couple of custom field definitions so the UI shows them out of the box.
  for (const def of [
    { key: 'plan_tier', label: 'Plan tier' },
    { key: 'signup_source', label: 'Signup source' },
  ]) {
    await prisma.customFieldDef.upsert({
      where: { accountId_key: { accountId: account.id, key: def.key } },
      update: {},
      create: { accountId: account.id, ...def },
    });
  }

  console.log('Seeded account "Acme Co" — login demo@dailyx.app / password123');
  console.log('Then import mock-data/contacts.csv from the Contacts page.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
