import Link from "next/link";
import { GeciMark } from "@/components/branding/geci-mark";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_#d1fae5,_#f8fafc_45%)]">
      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col justify-center px-4 py-6">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-emerald-700">
          Government Engineering College Idukki
        </p>
        <h1 className="mt-3 flex max-w-4xl items-center gap-4 text-4xl font-semibold tracking-tight text-emerald-950 md:gap-5 md:text-6xl">
          <GeciMark className="size-14 shrink-0 md:size-20" />
          <span>GECI Tally — live student election counting.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Counting Supervisors enter votes round by round. Returning Officers verify every entry.
          Hall results need a public results login. A post locks when its counted ballots are complete.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/results/login">Open hall results</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Open counting console</Link>
          </Button>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Counting Supervisor", "Assigned posts only. Confirm every round before it is saved."],
            ["Returning Officer", "Verify or reject submitted rounds. Progress is tracked against ballots polled."],
            ["Hall display login", "A dedicated public results account opens the live board for the hall projector."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border bg-white/80 p-5 shadow-sm">
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
