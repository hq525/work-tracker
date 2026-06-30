# Work Tracker

Personal app to capture work notes, generate STAR interview stories, and track behavioral-question coverage.

## Setup
1. Create a Neon Postgres database; copy its connection string.
2. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` (Neon)
   - `ANTHROPIC_API_KEY`
   - `APP_PASSWORD` (your login password)
   - `SESSION_SECRET` (32+ random bytes, e.g. `openssl rand -base64 32`)
3. `npm install`
4. `npm run db:migrate` (applies `db/schema.sql`)
5. `npm run dev`

## Deploy (Vercel)
- Import the repo in Vercel.
- Set the four env vars above in Project Settings → Environment Variables.
- Run the migration once against the production `DATABASE_URL` (`npm run db:migrate`).
- Deploy.

## Test
`npm test`
