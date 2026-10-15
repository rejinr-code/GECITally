import Link from "next/link";
import { GeciMark } from "@/components/branding/geci-mark";
import { MulearnCredit } from "@/components/branding/mulearn-credit";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#f4f7f4]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 420px at 12% -10%, rgba(4,120,87,0.18), transparent 70%), radial-gradient(700px 360px at 100% 8%, rgba(201,162,39,0.16), transparent 62%), linear-gradient(180deg, #ecf8f1 0%, #f4f7f4 42%, #eef4ef 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-800 via-[#c9a227] to-emerald-700"
      />

      <main className="relative mx-auto flex min-h-0 w-full flex-1 flex-col justify-center px-6 py-10 md:px-12 lg:px-16">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-800">
          Government Engineering College Idukki
        </p>
        <div className="mt-3 h-1 w-24 rounded-full bg-[#c9a227]" />

        <h1 className="mt-6 flex w-full items-center gap-4 text-4xl font-semibold tracking-tight text-emerald-950 md:gap-6 md:text-6xl">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-[0_18px_40px_-24px_rgba(4,120,87,0.7)] ring-1 ring-emerald-200 md:size-24">
            <GeciMark className="size-12 md:size-[4.5rem]" />
          </span>
          <span className="leading-[1.08]">
            GECI Tally
            <span className="mt-1 block text-2xl font-medium tracking-tight text-emerald-800 md:text-4xl">
              Live student election counting
            </span>
          </span>
        </h1>

        <section className="mt-8 w-full rounded-3xl border border-emerald-200/80 bg-white/80 p-6 shadow-[0_24px_60px_-36px_rgba(15,36,25,0.35)] backdrop-blur-sm md:p-8">
          <div className="space-y-4 text-lg leading-relaxed text-emerald-950/80">
            <p>
              GECI Tally is the live counting system for student union elections at Government Engineering College
              Idukki. It keeps one college-wide record of the count as it happens: each round is entered when ballots
              are opened, running totals stay on a verified tally, and the hall board shows results only after they are
              forwarded for public display.
            </p>
            <p>
              The desk, the Returning Officer, and the hall screen share the same figures, so the campus can follow the
              election without mixing paper sheets, side tallies, or unpublished rounds.
            </p>
          </div>
          <div className="mt-8">
            <Button asChild size="lg" className="h-12 px-7 text-base shadow-md shadow-emerald-900/15">
              <Link href="/results/login">Open hall results</Link>
            </Button>
          </div>
        </section>

        <div className="mt-8 w-full overflow-hidden rounded-3xl border border-[#e4d29a] bg-gradient-to-r from-[#fff8e5] via-white to-[#eef8f2] p-1 shadow-[0_18px_40px_-28px_rgba(201,162,39,0.55)]">
          <MulearnCredit className="w-full max-w-none justify-start border-0 bg-transparent px-5 py-4 shadow-none" />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
