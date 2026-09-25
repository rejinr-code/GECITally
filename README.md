# GECI Tally

Official student election counting system for **Government Engineering College Idukki**.

Counting Supervisors enter vote counts, a Returning Officer verifies each round, and hall results open only after a Returning Officer or public-results login.

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
14. `supabase/migrations/0014_multi_seat_ballots.sql`
15. `supabase/migrations/0015_candidate_slot_votes.sql`
16. `supabase/migrations/0016_integrity_and_authz.sql`
17. `supabase/seed.sql` (optional starter posts)

Then in **Database → Replication**, confirm `count_rounds` and `count_entries` are in the `supabase_realtime` publication (the migration adds them).

### 4. First admin user

In **Authentication → Users**, create a user (email/password). Then:

```sql
update public.profiles
   set role = 'admin',
       full_name = 'Election Admin'
 where id = '<auth-user-uuid>';
```

Counting Supervisor, Returning Officer, and public results display accounts should be created from `/admin` so roles and post assignments are applied correctly.

In **Authentication → Providers → Email**, turn **off** public sign-ups. New accounts should only come from `/admin`. If sign-up stays on, a stranger can create a Counting Supervisor profile. They still cannot submit counts without a post assignment, but they can open live results.

### 5. Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Roles

| Path | Role | Purpose |
|---|---|---|
| `/admin` | Admin | Panels, posts, candidates, people, count limit, live display, election state |
| `/staff` | Counting Supervisor | Enter per-candidate and invalid counts for assigned posts; open live results |
| `/supervisor` | Returning Officer | Verify or reject submitted rounds; open live results |
| `/results/login` | Public results | Dedicated hall / public results login |
| `/results` | Admin, Counting Supervisor, Returning Officer, Public results | Live animated results (login required) |

## Counting rules

- A round is all candidate counts for one post, plus invalid / spoilt ballots, saved in a single Postgres transaction.
- Invalid votes count toward the round size and votes polled. They do not add to a candidate.
- A post with more than one seat has that many marks on each ballot (1st, 2nd, …). Counting records one vote per seat, with a separate invalid count for each mark. Live results show 1st and 2nd totals per candidate the same way. Single-seat posts stay one vote per ballot.
- Duplicate submits are blocked in the UI (disabled button + ref guard) and in the database (`unique (post_id, staff_id, round_number)`).
- Count rows are written only by `submit_count_round` / `review_count_round`. Counting Supervisors cannot insert or self-verify rounds through the API.
- Verified rounds become part of the live tally. Admin can instead show pending rounds on the hall board immediately after a Counting Supervisor submits.
- When verified ballots for a post reach that post's votes polled, those totals are finalised and immutable.
- `count_limit` is the number of ballots in each round. The last round may contain fewer.
