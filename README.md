# GECI Tally

Official student election counting system for **Government Engineering College Idukki**.

Staff enter vote counts, a supervisor verifies each round, and hall results open only after a supervisor or public-results login.

## Stack

- Next.js (App Router) + TypeScript
- Supabase (Auth, Postgres, Realtime)
- Tailwind CSS + shadcn-style UI
- Framer Motion + Recharts

## Setup

### 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the project URL, anon key, and service role key.

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### 3. Database

In the Supabase SQL editor, run in order:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_panels_and_post_votes.sql`
3. `supabase/migrations/0003_candidate_branch_semester.sql`
4. `supabase/migrations/0004_candidate_year.sql`
5. `supabase/migrations/0005_live_display_settings.sql`
6. `supabase/migrations/0006_counting_without_supervisor.sql`
7. `supabase/migrations/0007_round_ballot_limit.sql`
8. `supabase/migrations/0008_counting_rpc_only.sql`
9. `supabase/migrations/0009_results_skip_counting_approval.sql`
10. `supabase/migrations/0010_results_tick.sql`
11. `supabase/migrations/0011_invalid_votes.sql`
12. `supabase/migrations/0012_admin_reset_finalised.sql`
13. `supabase/migrations/0013_display_role.sql`
14. `supabase/seed.sql` (optional starter posts)

Then in **Database → Replication**, confirm `count_rounds` and `count_entries` are in the `supabase_realtime` publication (the migration adds them).

### 4. First admin user

In **Authentication → Users**, create a user (email/password). Then:

```sql
update public.profiles
   set role = 'admin',
       full_name = 'Election Admin'
 where id = '<auth-user-uuid>';
```

Staff, supervisor, and public results display accounts should be created from `/admin` so roles and post assignments are applied correctly.

### 5. Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Roles

| Path | Role | Purpose |
|---|---|---|
| `/admin` | admin | Panels, posts, candidates, staff, count limit, live display, election state |
| `/staff` | staff | Enter per-candidate and invalid counts for assigned posts; open live results |
| `/supervisor` | supervisor | Verify or reject submitted rounds; open live results |
| `/results/login` | display | Dedicated hall / public results login |
| `/results` | staff, supervisor, display | Live animated results (login required) |

## Counting rules

- A round is all candidate counts for one post, plus invalid / spoilt ballots, saved in a single Postgres transaction.
- Invalid votes count toward the round size and votes polled. They do not add to a candidate.
- Duplicate submits are blocked in the UI (disabled button + ref guard) and in the database (`unique (post_id, staff_id, round_number)`).
- Count rows are written only by `submit_count_round` / `review_count_round`. Staff cannot insert or self-verify rounds through the API.
- Verified rounds become part of the live tally. Admin can instead show pending rounds on the hall board immediately after staff submit.
- When verified ballots for a post reach that post's votes polled, those totals are finalised and immutable.
- `count_limit` is the number of ballots in each round. The last round may contain fewer.
