import { invalidColumnLabels, type CountingReport, type CountingReportSheet } from "@/lib/counting-report";
import { formatNumber, ordinalMark } from "@/lib/utils";

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-bold">{children}</strong>;
}

function SignLine({
  title,
  name,
  action,
}: {
  title: string;
  name: string;
  action: string;
}) {
  return (
    <div className="w-[72mm] text-center text-[12.5px] leading-[1.35]">
      <div className="h-[16mm] border-b border-black" />
      <p className="mt-1 font-bold">{action}</p>
      <p className="mt-0.5 italic">{title}</p>
      <p className="mt-1">
        <Strong>{name}</Strong>
      </p>
      <p className="mt-3 text-left">
        Date: <span className="inline-block w-[38mm] border-b border-black">&nbsp;</span>
      </p>
    </div>
  );
}

function Sheet({
  report,
  sheet,
}: {
  report: CountingReport;
  sheet: CountingReportSheet;
}) {
  const invalidLabels = invalidColumnLabels(sheet.seats);
  const crowded = sheet.candidates.length + invalidLabels.length >= 7;
  const showSlots = sheet.marksPerBallot > 1;

  return (
    <section className="counting-sheet px-[12mm] py-[10mm] print:min-h-[297mm] print:px-[16mm] print:py-[14mm]">
      <header className="text-center">
        <p className="text-[17px] font-bold leading-tight">Government Engineering College Idukki, Painavu.</p>
        <p className="mt-0.5 text-[12.5px] italic">(Affiliated to APJ Abdul Kalam Technological University)</p>
        <p className="mt-3 text-[16px] font-bold">
          College Students&apos; Union Election <Strong>{report.academicYear}</Strong>
        </p>
        <h2 className="mt-1 text-[18px] font-bold uppercase">Counting Report</h2>
      </header>

      <div className="mt-3 flex items-start justify-between text-[13px]">
        <p>
          Election: <Strong>{report.electionName}</Strong>
        </p>
        <p>
          Dated, <Strong>{report.issuedOn}.</Strong>
        </p>
      </div>
      <p className="mt-1 text-[13px]">
        Date of poll: <Strong>{report.electionDate}</Strong>
      </p>

      <table className="mt-3 w-full border-collapse text-[12.5px]">
        <tbody>
          <tr>
            <th className="w-[28%] border border-black px-2 py-1.5 text-left font-bold">Name of Post</th>
            <td className="border border-black px-2 py-1.5" colSpan={3}>
              <Strong>{sheet.postName}</Strong>
              {sheet.seats > 1 ? ` (${sheet.seats} seats)` : ""}
            </td>
          </tr>
          <tr>
            <th className="border border-black px-2 py-1.5 text-left font-bold">Counting Supervisor</th>
            <td className="border border-black px-2 py-1.5">
              <Strong>{sheet.supervisorName}</Strong>
            </td>
            <th className="w-[22%] border border-black px-2 py-1.5 text-left font-bold">Returning Officer</th>
            <td className="border border-black px-2 py-1.5">
              <Strong>{report.returningOfficerName}</Strong>
            </td>
          </tr>
          <tr>
            <th className="border border-black px-2 py-1.5 text-left font-bold">Votes polled</th>
            <td className="border border-black px-2 py-1.5 tabular-nums">
              <Strong>{formatNumber(sheet.votesPolled)}</Strong>
            </td>
            <th className="border border-black px-2 py-1.5 text-left font-bold">Ballots counted</th>
            <td className="border border-black px-2 py-1.5 tabular-nums">
              <Strong>{formatNumber(sheet.countedBallots)}</Strong>
              {sheet.complete ? " (complete)" : sheet.votesPolled > 0 ? " (in progress)" : ""}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mt-3 text-[13px] leading-[1.45]">
        Round-wise count recorded by the Counting Supervisor. Pending rounds are shown and included until verified
        or rejected. Rejected rounds are omitted.
      </p>

      <table className={`mt-2 w-full border-collapse ${crowded ? "text-[9.5px] leading-[1.25]" : "text-[11.5px] leading-[1.35]"}`}>
        <thead>
          <tr>
            <th className="border border-black px-1 py-1 text-center font-bold">Round</th>
            <th className="border border-black px-1 py-1 text-center font-bold">Status</th>
            {sheet.candidates.map((candidate) => (
              <th key={candidate.id} className="border border-black px-1 py-1 text-left font-bold align-bottom">
                {candidate.name}
              </th>
            ))}
            {invalidLabels.map((label) => (
              <th key={label} className="border border-black px-1 py-1 text-center font-bold">
                {label}
              </th>
            ))}
            <th className="border border-black px-1 py-1 text-center font-bold">Ballots</th>
          </tr>
        </thead>
        <tbody>
          {sheet.rounds.map((round) => (
            <tr key={round.roundNumber}>
              <td className="border border-black px-1 py-1 text-center tabular-nums">{round.roundNumber}</td>
              <td className="border border-black px-1 py-1 text-center">
                {round.status === "verified" ? "Verified" : "Pending"}
              </td>
              {sheet.candidates.map((candidate) => (
                <td key={candidate.id} className="border border-black px-1 py-1 text-right tabular-nums">
                  {formatNumber(round.votes[candidate.id] ?? 0)}
                  {showSlots ? (
                    <span className="mt-0.5 block text-[8.5px] font-medium text-neutral-700">
                      {(round.slotVotes[candidate.id] ?? []).map((count, slot) => (
                        <span key={slot}>
                          {slot > 0 ? " · " : null}
                          {ordinalMark(slot)} {formatNumber(count)}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </td>
              ))}
              {invalidLabels.map((label, slot) => (
                <td key={label} className="border border-black px-1 py-1 text-right tabular-nums">
                  {formatNumber(round.invalidSlots[slot] ?? 0)}
                </td>
              ))}
              <td className="border border-black px-1 py-1 text-right tabular-nums font-semibold">
                {formatNumber(round.ballots)}
              </td>
            </tr>
          ))}
          <tr>
            <td className="border border-black px-1 py-1 text-center font-bold" colSpan={2}>
              Total
            </td>
            {sheet.candidates.map((candidate) => (
              <td key={candidate.id} className="border border-black px-1 py-1 text-right tabular-nums font-bold">
                {formatNumber(sheet.totals.votes[candidate.id] ?? 0)}
                {showSlots ? (
                  <span className="mt-0.5 block text-[8.5px] font-semibold">
                    {(sheet.totals.slotVotes[candidate.id] ?? []).map((count, slot) => (
                      <span key={slot}>
                        {slot > 0 ? " · " : null}
                        {ordinalMark(slot)} {formatNumber(count)}
                      </span>
                    ))}
                  </span>
                ) : null}
              </td>
            ))}
            {invalidLabels.map((label, slot) => (
              <td key={label} className="border border-black px-1 py-1 text-right tabular-nums font-bold">
                {formatNumber(sheet.totals.invalidSlots[slot] ?? 0)}
              </td>
            ))}
            <td className="border border-black px-1 py-1 text-right tabular-nums font-bold">
              {formatNumber(sheet.totals.ballots)}
            </td>
          </tr>
        </tbody>
      </table>

      {sheet.pendingRounds > 0 ? (
        <p className="mt-2 text-[12px]">
          {sheet.pendingRounds} round{sheet.pendingRounds === 1 ? "" : "s"} awaiting Returning Officer verification.
        </p>
      ) : null}

      <p className="mt-4 text-justify text-[13px] leading-[1.5]">
        Certified that the figures above are a true record of the votes counted for this post by the Counting
        Supervisor named herein. The Returning Officer has checked this record and countersigns it.
      </p>

      <div className="counting-sign mt-10 flex flex-wrap items-end justify-between gap-8">
        <SignLine title="Counting Supervisor" name={sheet.supervisorName} action="Signature" />
        <SignLine title="Returning Officer" name={report.returningOfficerName} action="Counter-signature" />
      </div>
    </section>
  );
}

export function CountingReportDocument({ report }: { report: CountingReport }) {
  return (
    <article className="counting-report mx-auto w-full max-w-[210mm] bg-white text-black shadow-sm ring-1 ring-black/10 print:max-w-none print:shadow-none print:ring-0">
      <div className="space-y-10" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
        {report.sheets.map((sheet) => (
          <Sheet key={`${sheet.postId}-${sheet.staffId}`} report={report} sheet={sheet} />
        ))}
      </div>
    </article>
  );
}
