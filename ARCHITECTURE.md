# DailyX — Architecture & Implementation Plan

A cut-down Mailchimp: a company signs up, imports contacts, groups them into
audiences, sends email campaigns (now or scheduled), and watches delivery/open
analytics update live. This document is the plan and the reasoning; the code in
this repo implements it.

---

## 1. What the assessment actually asks for (requirements → where it lives)

| Requirement | Must-have detail | Implemented in |
|---|---|---|
| **Auth + workspaces** | Sign up / log in; account A can never see account B's data; enforced **server-side** | `apps/api/src/routes/auth.ts`, `middleware/auth.ts`, every route's `where: { accountId }` |
| **Contacts CRUD** | name/email/phone + **user-defined custom fields**; dedup on manual add | `routes/contacts.ts`, `Contact.customFields` (JSON) + `CustomFieldDef` |
| **CSV import** | handle duplicate emails/phones; report "N added, M skipped" | `lib/csv.ts`, `POST /api/contacts/import` |
| **Audiences** | saved, named group built by **filtering**; show member count | `routes/audiences.ts`, `packages/shared/src/filter.ts` |
| **Campaigns** | name + subject + body; choose recipients by audience/tag **or** pasted emails/phones with name lookup + unmatched flagging; send now or **scheduled via Redis queue**; survive restart | `routes/campaigns.ts`, `services/*`, `queue/*`, `worker.ts` |
| **Analytics** | per-campaign sent/delivered/opened; **auto-refresh** every few seconds | `GET /api/campaigns/:id/stats` + 4s polling in `campaigns/[id]/page.tsx` |
| **Deploy** | genuinely runs in production | `render.yaml` (API+worker+PG+Redis) + Vercel (web) |
| **Extra credit** | duplicate a campaign; (attachments noted as follow-up) | `POST /api/campaigns/:id/duplicate` |

The graders explicitly said the things that stand out the **wrong** way are:
UI-only account checks, duplicates slipping through, faked scheduling, static
analytics, committed secrets, or no deploy. Each of those has a dedicated
defense below.

---

## 2. System design (C4-ish, level 2)

```
            ┌──────────────┐         HTTPS (JWT bearer + cookie)
   Browser  │  Next.js web │ ───────────────────────────────┐
   (user)   │  (Vercel)    │                                 ▼
            └──────────────┘                        ┌─────────────────┐
                                                     │  Express API    │
            Mailgun ──webhook (signed)──────────────▶│  (Render web)   │
              ▲   ▲                                   └───────┬─────────┘
              │   │ send (HTTP API)                           │ enqueue
     open px  │   └───────────────────────────┐               ▼
     loaded   │                               │        ┌─────────────┐
   by client  │                          ┌────┴─────┐  │   Redis     │
              └──────────────────────────│  Worker  │◀─│  (BullMQ)   │
                                         │ (Render) │  └─────────────┘
                                         └────┬─────┘
                                              │ read/write
                                         ┌────▼─────┐
                                         │ Postgres │
                                         └──────────┘
```

Four deployables, one repo (pnpm + Turborepo monorepo):

- **web** — Next.js App Router UI. Talks only to the API over HTTP.
- **api** — Express. The only thing that touches the database directly for
  request traffic. Owns auth, tenancy, CRUD, and enqueuing sends.
- **worker** — same codebase, different entrypoint (`worker.ts`). Consumes the
  BullMQ queue and does the actual email sending. Separated so a slow/large send
  never blocks the API event loop and so it can scale independently.
- **Postgres** + **Redis** — storage and the durable job queue.

**Why front and back are split** (the brief asked for this explicitly): the API
is a standalone Express service, not Next API routes. That keeps the send worker,
queue, and webhook receiver in one Node process family that can run outside
Vercel's serverless model — serverless functions are the wrong host for a
long-running BullMQ worker.

---

## 3. Data model

See `packages/db/prisma/schema.prisma`. Entity summary:

- **Account** 1─* **User** — the tenant boundary. A user belongs to exactly one
  account; signing up creates both.
- **Contact** — `name, email, phone, city, tags[]`, plus `customFields` (JSON)
  for the "bring your own fields" requirement, plus **normalized dedup keys**
  `emailKey` / `phoneKey`.
- **CustomFieldDef** — per-account registry of custom keys so the UI can render
  inputs and audiences can offer them as filter fields.
- **Audience** — a **saved filter** (`filter` JSON), not a frozen list. Count is
  computed on demand, so a newly imported matching contact is included
  automatically.
- **Campaign** — `name, subject, body, status`, recipient `source`
  (AUDIENCE | TAG | MANUAL), `scheduledAt`, `jobId` (the BullMQ handle).
- **CampaignRecipient** — one row per email per campaign (unique
  `[campaignId, email]`). Stores a **snapshot** of name/email so later contact
  edits don't rewrite history, plus `providerMessageId` to tie webhooks back,
  and per-recipient `status` / `openedAt` / `openCount`.
- **EmailEvent** — append-only provider event log; `providerEventId` is unique
  so a re-delivered webhook is idempotent.

### Why these choices (ADR-style)

**ADR-1 — Custom fields as a JSON column, not EAV.**
Options were (a) a rigid schema, (b) Entity-Attribute-Value tables, (c) a JSONB
column + a lightweight key registry. Chose (c). JSONB keeps contacts in one row
(simple, fast reads), Postgres can index/filter into it, and `CustomFieldDef`
gives us the enumerable key list that pure JSON lacks. EAV was rejected as
heavier to query with no real upside at this scale. Trade-off: JSON values are
untyped strings; acceptable for marketing fields.

**ADR-2 — Audiences are saved filters, not membership snapshots.**
A stored `filter` re-evaluated at read/send time means audiences stay live as
contacts change. Trade-off: sending resolves the filter each time (a query), but
that's cheap and correct. If we later needed point-in-time reproducibility we'd
snapshot into `CampaignRecipient` at send — which we already do.

**ADR-3 — Dedup enforced by DB unique indexes, not just app code.**
`@@unique([accountId, emailKey])` and `@@unique([accountId, phoneKey])` make
duplicates impossible even under a race between two concurrent imports. App-level
checks give nice messages; the index is the actual guarantee. See §5.

---

## 4. Multi-tenant isolation (the part they said they'll attack)

> "We will try to reach across accounts to see if we can."

Defense in depth, all server-side:

1. **Identity from a signed token, never from the client.** The account id lives
   inside the JWT (`{ userId, accountId }`), signed with `JWT_SECRET`. The client
   cannot set or spoof it. `requireAuth` verifies the token and populates
   `req.auth`.
2. **Every query is scoped.** Handlers read `accountId(req)` and pass
   `where: { accountId }` on **every** read and write. There is no code path that
   looks up a row by id alone. Deletes/updates use `deleteMany/updateMany` with
   the `accountId` guard (or `findFirst({ id, accountId })` first), so guessing
   another account's `campaignId` returns 404, not someone else's data.
3. **Denormalized `accountId` on child rows** (`CampaignRecipient`,
   `EmailEvent`) so even analytics aggregation is tenant-scoped without a join.
4. **Cross-references are re-checked.** Creating a campaign with an `audienceId`
   verifies that audience belongs to the caller before accepting it.

**How I'd test it** (and how they will): log in as account A, grab a
`campaignId`, then as account B call `GET /api/campaigns/<A's id>` → expect 404;
`POST /api/campaigns` with A's `audienceId` → expect 400. Every resource route
follows the same shape, so the property holds uniformly.

---

## 5. The fiddly bits

### 5.1 Messy CSV import + dedup
Pipeline in `lib/csv.ts` → `routes/contacts.ts`:

1. **Normalize** each row: `emailKey = lower(trim(email))`,
   `phoneKey = "+" + digitsOnly(phone)`. So `+91 98765 43210` and
   `+919876543210` collapse to the same key.
2. **De-dupe within the file** first (the sample has `sneha@`/`priya@` repeated
   and shared phones) — later occurrences are counted as skipped.
3. **De-dupe against the DB** — skip rows whose email or phone already exists for
   this account. The same check runs on manual single-contact add, so the two
   paths behave identically.
4. **Unknown columns become custom fields** and register in `CustomFieldDef`.
5. **Report back**: `{ added, skippedDuplicatesInFile, skippedAlreadyExisting,
   skippedMissingEmail, message: "15 added, 3 skipped as duplicates" }`.

On the provided 18-row file you get **16 added, 2 skipped** (the duplicate
`sneha@example.com` and `priya@example.com` rows; note their phones are dupes too).

### 5.2 Provider webhooks (Mailgun)
`routes/webhooks.ts`:
- **Verify the signature** — HMAC-SHA256 of `timestamp + token` with the webhook
  signing key, compared with `timingSafeEqual`. Unsigned/forged calls are 401'd.
- **Match** the event to a recipient by `providerMessageId` (Mailgun `Message-Id`).
- **Idempotent** — the raw event is inserted with a unique `providerEventId`; a
  duplicate delivery hits the unique constraint and is ignored, so opens are
  never double-counted.
- **Always 200** for unmatched/known events so Mailgun stops retrying.
- State transitions never downgrade (`delivered` won't overwrite `opened`).

### 5.3 Scheduling as real queued jobs
`queue/index.ts` + `worker.ts`:
- A scheduled campaign is a **BullMQ delayed job** with a deterministic
  `jobId = campaign:<id>`. BullMQ persists delayed jobs in Redis, so they fire at
  the right time and **survive an API/worker restart** — no `setTimeout`, no
  interval scanning the table.
- Rescheduling/cancelling removes the existing job by id, so there's never a
  duplicate send.
- **Belt-and-suspenders reconciler**: on worker boot, `reconcileScheduled()`
  re-enqueues any campaign still `SCHEDULED` in the DB. The database is the
  source of truth; Redis is the timer. If Redis were ever flushed, schedules are
  rebuilt from Postgres.
- **Immediate sends also go through the queue** (zero delay) so the request
  returns fast and the send path is identical whether now or later.

### 5.4 Send path & retries
`services/campaigns.ts::processCampaignSend` only sends to recipients still
`PENDING`, so a retried job (BullMQ `attempts: 3`, exponential backoff) resumes
rather than double-sending. Each success records `providerMessageId`.

---

## 6. Analytics that actually move
`GET /api/campaigns/:id/stats` groups `CampaignRecipient` by status and derives
sent / delivered / opened / rates. The detail page polls it every **4 seconds**
(`setInterval`), with a live indicator dot. Counts climb as Mailgun webhooks
arrive. The README notes open tracking is inherently approximate (pixel blocking),
per the brief.

---

## 7. Design system

Tokens live in `apps/web/tailwind.config.ts` and component classes in
`globals.css` — components never hardcode hex. Summary:

- **Color**: `brand` (indigo 500/600/700), `ink` neutrals (900→100), semantic
  `success`/`warning`/`danger`. Status→color mapping is centralized in
  `StatusBadge`.
- **Type**: system sans stack; sizes via Tailwind scale; `tabular-nums` on stats
  so digits don't jitter while polling.
- **Radius/shadow**: `rounded-xl` + a single soft `shadow-card` for all cards.
- **Primitives**: `.btn-primary/.btn-ghost/.btn-danger`, `.input`, `.label`,
  `.card`; React primitives `Badge`, `StatusBadge`, `Stat`, `Modal`,
  `EmptyState`. One card pattern, one table pattern, one modal — consistency over
  variety.
- **States covered**: empty (`EmptyState`), loading ("Loading…"), error (red
  banners), disabled buttons while busy.

---

## 8. Self code-review checklist (what I'd flag in a PR review of this)

- [x] No route reads a tenant row without an `accountId` filter.
- [x] Dedup guaranteed by DB index, not only app logic.
- [x] Secrets only in `.env` (git-ignored); `.env.example` documents every var.
- [x] Webhook signature verified; handler idempotent; always 200 to provider.
- [x] Scheduling is durable (Redis-backed) + reconciled from DB on boot.
- [x] Input validated with zod at the boundary; central error handler maps
      zod/Prisma errors to clean 4xx.
- [x] Passwords bcrypt-hashed; JWT expiry set; httpOnly cookie + bearer.
- [x] Send is retry-safe (only PENDING recipients) — no double sends.
- [ ] **Follow-ups if I had more time**: per-recipient send rate limiting for
      large lists (batch + `Queue` fan-out per recipient), attachments (Mailgun
      multipart), audit log of who sent what, and integration tests around the
      isolation property and the CSV dedup counts.

---

## 9. Known trade-offs / if-I-had-more-time
- **Sending loops in one job.** Fine for the assessment's ~5 verified sandbox
  recipients. At real volume I'd fan out one job per recipient (or batches) for
  parallelism and finer retry granularity.
- **Attachments** (extra credit) are scoped out; the send function is one field
  away from supporting Mailgun's multipart `attachment`.
- **No email HTML sanitization** — bodies are trusted operator input; a real
  product would sanitize/whitelist.
- **Polling, not websockets** for analytics — the brief said polling is fine and
  it's simpler/robust on free tiers.
