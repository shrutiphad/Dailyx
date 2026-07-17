// Demo seed — fills a workspace with a realistic, lived-in dataset so every
// screen (contacts, audiences, campaigns, analytics) has something to show.
//
// The provider events here are SIMULATED: they mimic what Mailgun's delivered/
// opened webhooks would have written, so the analytics page has history to render
// without waiting on real mail. Live sends still go through the real path.
//
// Idempotent: fixed ids + upserts, so running it twice is safe.
//   pnpm db:seed:demo
import bcrypt from 'bcryptjs';
import { prisma } from './index';
import { normalizeEmail, normalizePhone } from '@dailyx/shared';

const ACCOUNT_ID = 'seed-account';
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);
const minsAfter = (base: Date, m: number) => new Date(base.getTime() + m * 60_000);

// Mirrors mock-data/contacts.csv after de-duplication (16 unique people).
const CONTACTS = [
  { name: 'Aarav Sharma', email: 'aarav@example.com', phone: '+919876543210', city: 'Mumbai', tags: ['vip', 'newsletter'], customFields: { plan_tier: 'pro', signup_source: 'web' } },
  { name: 'Priya Patel', email: 'priya@example.com', phone: '+919812345678', city: 'Mumbai', tags: ['newsletter'], customFields: { plan_tier: 'free', signup_source: 'web' } },
  { name: 'Rohan Mehta', email: 'rohan@example.com', phone: '+919900112233', city: 'Delhi', tags: ['vip'], customFields: { plan_tier: 'pro' } },
  { name: 'Sneha Iyer', email: 'sneha@example.com', phone: '+919845098450', city: 'Bengaluru', tags: ['newsletter'], customFields: { signup_source: 'import' } },
  { name: 'Vikram Singh', email: 'vikram@example.com', phone: '+919765432100', city: 'Delhi', tags: ['delhi', 'vip'], customFields: { plan_tier: 'pro' } },
  { name: 'Ananya Rao', email: 'ananya@example.com', phone: '+919723456789', city: 'Delhi', tags: ['delhi'], customFields: {} },
  { name: 'Karan Kapoor', email: 'karan@example.com', phone: '+919688776655', city: 'Pune', tags: ['newsletter'], customFields: { signup_source: 'web' } },
  { name: 'Arjun Desai', email: 'arjun@example.com', phone: '+919833445566', city: 'Mumbai', tags: ['vip'], customFields: { plan_tier: 'pro' } },
  { name: 'Isha Gupta', email: 'isha@example.com', phone: '+919877001122', city: 'Delhi', tags: ['newsletter'], customFields: {} },
  { name: 'Nisha Reddy', email: 'nisha@example.com', phone: '+919744556677', city: 'Delhi', tags: ['newsletter', 'delhi'], customFields: { plan_tier: 'free' } },
  { name: 'Sameer Khan', email: 'sameer@example.com', phone: '+919655443322', city: 'Mumbai', tags: ['mumbai'], customFields: {} },
  { name: 'Tara Joshi', email: 'tara@example.com', phone: '+919788990011', city: 'Pune', tags: ['vip', 'newsletter'], customFields: { plan_tier: 'pro', signup_source: 'referral' } },
  { name: 'Rahul Verma', email: 'rahul@example.com', phone: '+919822334455', city: 'Delhi', tags: ['delhi'], customFields: {} },
  { name: 'Pooja Bhat', email: 'pooja@example.com', phone: '+919766778899', city: 'Bengaluru', tags: ['mumbai'], customFields: { signup_source: 'import' } },
  { name: 'Aditya Kumar', email: 'aditya@example.com', phone: '+919899887766', city: 'Delhi', tags: ['vip', 'delhi'], customFields: { plan_tier: 'pro' } },
  { name: 'Kavya Menon', email: 'kavya@example.com', phone: '+919911223344', city: 'Bengaluru', tags: ['newsletter'], customFields: {} },
];

const AUDIENCES = [
  { id: 'demo-aud-newsletter', name: 'Newsletter subscribers', filter: { match: 'all', rules: [{ field: 'tag', op: 'has_tag', value: 'newsletter' }] } },
  { id: 'demo-aud-delhi', name: 'Delhi contacts', filter: { match: 'all', rules: [{ field: 'city', op: 'eq', value: 'Delhi' }] } },
  { id: 'demo-aud-vip', name: 'VIP customers', filter: { match: 'all', rules: [{ field: 'tag', op: 'has_tag', value: 'vip' }] } },
  { id: 'demo-aud-metro', name: 'Mumbai or Pune', filter: { match: 'any', rules: [{ field: 'city', op: 'eq', value: 'Mumbai' }, { field: 'city', op: 'eq', value: 'Pune' }] } },
];

// status mix per campaign → drives what the analytics page renders.
type Mix = { email: string; status: 'OPENED' | 'DELIVERED' | 'SENT' | 'BOUNCED' | 'PENDING'; opens?: number };

async function main() {
  const account = await prisma.account.upsert({
    where: { id: ACCOUNT_ID },
    update: {},
    create: { id: ACCOUNT_ID, name: 'Acme Co' },
  });

  await prisma.user.upsert({
    where: { email: 'demo@dailyx.app' },
    update: { passwordHash: await bcrypt.hash('password123', 10) },
    create: {
      accountId: account.id,
      email: 'demo@dailyx.app',
      name: 'Demo User',
      passwordHash: await bcrypt.hash('password123', 10),
    },
  });

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

  // ---- contacts -----------------------------------------------------------
  for (const c of CONTACTS) {
    const emailKey = normalizeEmail(c.email);
    await prisma.contact.upsert({
      where: { accountId_emailKey: { accountId: account.id, emailKey } },
      update: {},
      create: {
        accountId: account.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        city: c.city,
        tags: c.tags,
        customFields: c.customFields,
        emailKey,
        phoneKey: normalizePhone(c.phone),
      },
    });
  }
  const contacts = await prisma.contact.findMany({ where: { accountId: account.id } });
  const byEmail = new Map(contacts.map((c) => [c.email, c]));

  // ---- audiences ----------------------------------------------------------
  for (const a of AUDIENCES) {
    await prisma.audience.upsert({
      where: { id: a.id },
      update: { name: a.name, filter: a.filter },
      create: { id: a.id, accountId: account.id, name: a.name, filter: a.filter },
    });
  }

  // ---- campaigns ----------------------------------------------------------
  const tagged = (t: string) => contacts.filter((c) => c.tags.includes(t)).map((c) => c.email);
  const inCity = (city: string) => contacts.filter((c) => c.city === city).map((c) => c.email);

  // 1. A finished send with a healthy open rate.
  const newsletterSentAt = daysAgo(3);
  const newsletterMix: Mix[] = tagged('newsletter').map((email, i) => ({
    email,
    status: i < 4 ? 'OPENED' : i < 7 ? 'DELIVERED' : 'SENT',
    opens: i < 4 ? (i === 0 ? 3 : 1) : 0,
  }));
  await seedCampaign({
    id: 'demo-camp-newsletter',
    name: 'July Newsletter',
    subject: "What's new at Acme this month",
    body: '<h1>Hello!</h1><p>Here is everything we shipped in July — new dashboards, faster exports, and a fresh mobile app.</p>',
    status: 'SENT',
    source: 'AUDIENCE',
    audienceId: 'demo-aud-newsletter',
    sentAt: newsletterSentAt,
    mix: newsletterMix,
  });

  // 2. A send with a bounce, so the failure path is visible too.
  const meetupSentAt = daysAgo(1);
  const meetupMix: Mix[] = inCity('Delhi').map((email, i) => ({
    email,
    status: i < 2 ? 'OPENED' : i < 6 ? 'DELIVERED' : 'BOUNCED',
    opens: i < 2 ? 1 : 0,
  }));
  await seedCampaign({
    id: 'demo-camp-delhi',
    name: 'Delhi Meetup Invite',
    subject: 'You are invited — Acme Delhi meetup',
    body: '<p>Join us on Friday at 6pm for food, demos and a short roadmap talk.</p>',
    status: 'SENT',
    source: 'AUDIENCE',
    audienceId: 'demo-aud-delhi',
    sentAt: meetupSentAt,
    mix: meetupMix,
  });

  // 3. A real queued schedule. The worker's reconciler picks this up on boot and
  //    fires it at the scheduled time — recipients are already PENDING.
  const scheduledAt = new Date(Date.now() + 86_400_000); // +1 day
  await seedCampaign({
    id: 'demo-camp-scheduled',
    name: 'Diwali Sale Preview',
    subject: 'Early access: our Diwali offers',
    body: '<p>As a VIP you get 24h early access to every Diwali deal.</p>',
    status: 'SCHEDULED',
    source: 'TAG',
    tag: 'vip',
    scheduledAt,
    mix: tagged('vip').map((email) => ({ email, status: 'PENDING' as const })),
  });

  // 4. A draft using the pasted-list flow, including one address that won't match.
  await prisma.campaign.upsert({
    where: { id: 'demo-camp-draft' },
    update: {},
    create: {
      id: 'demo-camp-draft',
      accountId: account.id,
      name: 'Welcome Series (draft)',
      subject: 'Welcome aboard 👋',
      body: '<p>Thanks for joining Acme. Here are three things to try first.</p>',
      status: 'DRAFT',
      source: 'MANUAL',
      manualEntries: ['aarav@example.com', 'tara@example.com', 'someone@not-a-contact.com'],
    },
  });

  const counts = await Promise.all([
    prisma.contact.count({ where: { accountId: account.id } }),
    prisma.audience.count({ where: { accountId: account.id } }),
    prisma.campaign.count({ where: { accountId: account.id } }),
    prisma.campaignRecipient.count({ where: { accountId: account.id } }),
  ]);
  console.log(`\nDemo workspace ready — login demo@dailyx.app / password123`);
  console.log(`  contacts: ${counts[0]} · audiences: ${counts[1]} · campaigns: ${counts[2]} · recipients: ${counts[3]}`);
  console.log(`  "July Newsletter" and "Delhi Meetup Invite" have analytics to view.`);
  console.log(`  "Diwali Sale Preview" is scheduled for ${scheduledAt.toLocaleString()}.\n`);

  // -------------------------------------------------------------------------
  async function seedCampaign(opts: {
    id: string;
    name: string;
    subject: string;
    body: string;
    status: 'SENT' | 'SCHEDULED';
    source: 'AUDIENCE' | 'TAG';
    audienceId?: string;
    tag?: string;
    sentAt?: Date;
    scheduledAt?: Date;
    mix: Mix[];
  }) {
    await prisma.campaign.upsert({
      where: { id: opts.id },
      update: { status: opts.status, sentAt: opts.sentAt ?? null, scheduledAt: opts.scheduledAt ?? null },
      create: {
        id: opts.id,
        accountId: account.id,
        name: opts.name,
        subject: opts.subject,
        body: opts.body,
        status: opts.status,
        source: opts.source,
        audienceId: opts.audienceId ?? null,
        tag: opts.tag ?? null,
        sentAt: opts.sentAt ?? null,
        scheduledAt: opts.scheduledAt ?? null,
      },
    });

    // Rebuild recipients/events so re-runs stay consistent.
    await prisma.emailEvent.deleteMany({ where: { recipient: { campaignId: opts.id } } });
    await prisma.campaignRecipient.deleteMany({ where: { campaignId: opts.id } });

    for (const m of opts.mix) {
      const contact = byEmail.get(m.email);
      if (!contact) continue;
      const base = opts.sentAt ?? new Date();
      const delivered = m.status === 'DELIVERED' || m.status === 'OPENED';
      const opened = m.status === 'OPENED';
      const live = m.status !== 'PENDING';

      const recipient = await prisma.campaignRecipient.create({
        data: {
          accountId: account.id,
          campaignId: opts.id,
          contactId: contact.id,
          email: contact.email,
          name: contact.name,
          status: m.status,
          providerMessageId: live ? `demo-${opts.id}-${contact.id}@mailgun.demo` : null,
          error: m.status === 'BOUNCED' ? 'Recipient address rejected: mailbox unavailable' : null,
          sentAt: live ? base : null,
          deliveredAt: delivered ? minsAfter(base, 1) : null,
          openedAt: opened ? minsAfter(base, 42) : null,
          openCount: m.opens ?? 0,
        },
      });

      // Simulated provider events — the same rows a real webhook would insert.
      if (delivered) {
        await prisma.emailEvent.create({
          data: {
            accountId: account.id,
            recipientId: recipient.id,
            type: 'delivered',
            providerEventId: `demo-evt-${recipient.id}-delivered`,
            payload: { event: 'delivered', simulated: true, recipient: contact.email },
          },
        });
      }
      if (opened) {
        await prisma.emailEvent.create({
          data: {
            accountId: account.id,
            recipientId: recipient.id,
            type: 'opened',
            providerEventId: `demo-evt-${recipient.id}-opened`,
            payload: { event: 'opened', simulated: true, recipient: contact.email },
          },
        });
      }
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
