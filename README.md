# DailyX

A small email-marketing app (a cut-down Mailchimp): sign up, import contacts,
group them into audiences, send campaigns now or on a schedule, and watch
delivery/open analytics update live.

> Full reasoning, data model, ADRs, and the isolation/scheduling design are in
> **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

## Stack

- **Web** — Next.js 14 (App Router) + Tailwind → deploy on Vercel
- **API** — Express + TypeScript
- **Worker** — BullMQ consumer (same codebase, separate entrypoint)
- **DB** — Postgres via Prisma
- **Queue** — Redis + BullMQ (durable, restart-safe scheduling)
- **Email** — Mailgun (send + open-tracking webhooks)
- Monorepo: pnpm workspaces + Turborepo

```
apps/
  web/     Next.js frontend
  api/     Express API + BullMQ worker (src/index.ts = API, src/worker.ts = worker)
packages/
  db/      Prisma schema, client, seed
  shared/  zod schemas, normalization/dedup, audience-filter engine
```

## Run it locally

Prereqs: Node 20+, pnpm 9 (`corepack enable`), Docker (for Postgres + Redis).

```bash
# 1. install
pnpm install

# 2. start Postgres + Redis
docker compose up -d

# 3. env
cp .env.example .env        # fill in Mailgun keys (optional — see "Dry-run" below)

# 4. database
pnpm db:generate
pnpm db:migrate             # creates tables
pnpm db:seed                # demo account: demo@dailyx.app / password123

# 5. run all three (in separate terminals, or `pnpm dev` via turbo)
pnpm dev:api                # http://localhost:4000
pnpm dev:worker            # BullMQ worker
pnpm dev:web               # http://localhost:3000
```

Log in with **demo@dailyx.app / password123**, go to Contacts → Import CSV, and
pick `mock-data/contacts.csv`.

### Dry-run without Mailgun
If Mailgun vars are unset, the API runs in **dry-run**: sends are simulated and
marked `SENT`, so scheduling and the whole UI still work — you just won't get
real `delivered`/`opened` webhooks. Set the Mailgun vars to send for real.

### Mailgun setup (free sandbox, no domain needed)
1. Create a Mailgun account → use the **sandbox** domain.
2. Add your own email as an **authorized recipient** (sandbox sends only to
   verified addresses — ~5 is plenty here).
3. Put `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM` in `.env`.
4. For opens: Mailgun → Webhooks → add a webhook for **delivered** and **opened**
   pointing at `${API_PUBLIC_URL}/api/webhooks/mailgun`. Copy the **HTTP webhook
   signing key** into `MAILGUN_WEBHOOK_SIGNING_KEY`.
5. Locally, expose the API with `ngrok http 4000` and use that URL as
   `API_PUBLIC_URL` / the webhook target.

## Environment variables

| Var | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | api, worker, db | Postgres connection string |
| `REDIS_URL` | api, worker | BullMQ connection |
| `JWT_SECRET` | api | long random string; signs sessions |
| `JWT_EXPIRES_IN` | api | default `7d` |
| `WEB_ORIGIN` | api | browser origin(s) for CORS (comma-sep) |
| `API_PUBLIC_URL` | api | public URL Mailgun posts webhooks to |
| `MAILGUN_API_KEY` / `MAILGUN_DOMAIN` / `MAILGUN_FROM` | api, worker | sending |
| `MAILGUN_BASE_URL` | api | `https://api.mailgun.net` (US) or EU variant |
| `MAILGUN_WEBHOOK_SIGNING_KEY` | api | verifies webhook signatures |
| `NEXT_PUBLIC_API_URL` | web | base URL of the API |

Never commit `.env`. Only `.env.example` is checked in.

## Deploy

**API + worker + Postgres + Redis → Render** via `render.yaml` (blueprint):
`New → Blueprint → point at the repo`. It provisions all four, runs migrations on
build, and starts the API and worker. Set the `sync: false` vars (Mailgun keys,
`WEB_ORIGIN` = your Vercel URL, `API_PUBLIC_URL` = the Render API URL) in the
dashboard.

**Web → Vercel**: import the repo, set **Root Directory** to `apps/web`, add
`NEXT_PUBLIC_API_URL` = your Render API URL. Then set the API's `WEB_ORIGIN` to
the Vercel URL and redeploy the API so CORS + cookies line up.

Point the Mailgun webhook at `https://<render-api>/api/webhooks/mailgun`.

## What's implemented vs. skipped

Implemented: auth + isolated workspaces (server-enforced), contacts CRUD with
custom fields, CSV import with duplicate handling + summary, audiences as saved
filters with live counts, campaigns by audience/tag/pasted-list (with name lookup
and unmatched flagging), send-now and **queued scheduled** sends that survive
restart, Mailgun sending + signed webhooks, live-polling analytics, and campaign
**duplication** (extra credit).

Skipped (with how I'd do them, per the brief): **attachments** — one Mailgun
multipart field away; per-recipient fan-out for large lists; automated tests for
the isolation property and CSV dedup counts. See ARCHITECTURE.md §8–9.
