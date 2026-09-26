import { ceremonySentence } from "@/lib/result-report";
import type { ResultReport, ResultReportRow } from "@/lib/result-report";

function officialName(name: string) {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

function groupedRows(rows: ResultReportRow[]) {
  const groups: Array<{ serial: number; postName: string; people: ResultReportRow[] }> = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.postName === row.postName) last.people.push(row);
    else groups.push({ serial: row.serial, postName: row.postName, people: [row] });
  }
  return groups;
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-bold">{children}</strong>;
}

export function ResultReportDocument({ report }: { report: ResultReport }) {
  const groups = groupedRows(report.rows);
  const ceremony = ceremonySentence(report);

  return (
    <article className="result-report mx-auto w-full max-w-[210mm] bg-white text-black shadow-sm ring-1 ring-black/10 print:max-w-none print:shadow-none print:ring-0">
      <div className="px-[16mm] py-[12mm] print:px-0 print:py-0" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
        <header className="text-center">
          <p className="text-[17px] font-bold leading-tight">
            Government Engineering College Idukki, Painavu.
          </p>
          <p className="mt-0.5 text-[12.5px] italic">(Affiliated to APJ Abdul Kalam Technological University)</p>
        </header>

        <div className="mt-3 flex items-start justify-between text-[13px]">
          <p>
            No. {report.fileNo ? <Strong>{report.fileNo}</Strong> : <span className="inline-block w-[52mm] border-b border-black">&nbsp;</span>}
          </p>
          <p>
            Dated, <Strong>{report.issuedOn}.</Strong>
          </p>
        </div>

        <p className="mt-4 text-center text-[16px] font-bold">
          College Students&apos; Union Election <Strong>{report.academicYear}</Strong>
        </p>
        <h1 className="mt-1 text-center text-[18px] font-bold uppercase">Result Declaration</h1>

        <p className="mt-3 text-justify text-[13px] leading-[1.5]">
          Ref : University Election Schedule issued by APJ Abdul Kalam Technological University
          {report.refNo ? (
            <>
              {" "}
              No. <Strong>{report.refNo}</Strong>
            </>
          ) : null}
          {report.refDated ? (
            <>
              , dated <Strong>{report.refDated}</Strong>
            </>
          ) : null}
          .
        </p>

        <p className="mt-3 text-justify text-[13px] leading-[1.5]">
          The following candidates have been elected to the College Union <Strong>{report.academicYear}</Strong>,
        </p>

        <table className="mt-3 w-full border-collapse text-[12.5px] leading-[1.35]">
          <thead>
            <tr>
              <th className="w-[9%] border border-black px-1.5 py-1.5 text-center font-bold leading-tight">
                Sl.
                <br />
                No.
              </th>
              <th className="w-[28%] border border-black px-2 py-1.5 text-left font-bold">Name of Post</th>
              <th className="w-[33%] border border-black px-2 py-1.5 text-left font-bold">Name of the Candidate</th>
              <th className="w-[14%] border border-black px-2 py-1.5 text-left font-bold">Class</th>
              <th className="w-[16%] border border-black px-2 py-1.5 text-left font-bold">Margin</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) =>
              group.people.map((person, index) => (
                <tr key={`${group.serial}-${person.candidateName}`}>
                  {index === 0 ? (
                    <>
                      <td className="border border-black px-1.5 py-1.5 text-center align-top" rowSpan={group.people.length}>
                        {group.serial}.
                      </td>
                      <td className="whitespace-pre-line border border-black px-2 py-1.5 align-top" rowSpan={group.people.length}>
                        {group.postName}
                      </td>
                    </>
                  ) : null}
                  <td className="border border-black px-2 py-1.5 align-top">
                    <Strong>{officialName(person.candidateName)}</Strong>
                  </td>
                  <td className="border border-black px-2 py-1.5 align-top">
                    <Strong>{person.classLabel}</Strong>
                  </td>
                  <td className="border border-black px-2 py-1.5 align-top">
                    <Strong>{person.margin}</Strong>
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>

        <p className="mt-4 text-justify text-[13px] leading-[1.5]">
          {ceremony.map((part, index) =>
            part.bold ? <Strong key={index}>{part.text}</Strong> : <span key={index}>{part.text}</span>,
          )}
        </p>

        <div className="mt-14 flex justify-end">
          <p className="w-[48mm] text-center text-[14px] font-bold italic">Returning Officer</p>
        </div>
      </div>
    </article>
  );
}
