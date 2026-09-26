# GECI Tally — Counting Supervisor (Flutter)

Mobile counting desk for **Counting Supervisors** (`staff` role). It uses the same Supabase project and the same Vote → Confirm → Review and submit flow as the web app. Returning Officer verification and the hall display stay on the web app.

## Setup

1. Copy environment values from the web app (public anon key only — never the service role key):

```powershell
copy .env.example .env
```

Fill `SUPABASE_URL` and `SUPABASE_ANON_KEY` with the same values as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

2. From this folder:

```powershell
flutter pub get
flutter run
```

To pass keys from the repo-root `.env.local` without copying them:

```powershell
.\tool\run.ps1
```

## Login

Sign in with a Counting Supervisor account created in `/admin`. Other roles are signed out with an error — this app does not include admin, Returning Officer, or hall display.

## Counting

- One Vote queues a mark. Confirm commits it. Numbers are not typed.
- Multi-seat posts take one mark per seat on the ballot, then Confirm.
- Invalid / spoilt marks count toward the round, not toward a candidate.
- Review and submit calls `submit_count_round` with the signed-in user JWT.

## Theme

Colours, Poppins, and the GECI crest match the Next.js app (`#047857` primary, `#f4f7f4` background, `#c9a227` gold).
