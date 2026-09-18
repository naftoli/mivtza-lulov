import { fmt } from '../lib/format.js'
import { Card, SectionHeader, Pill } from './ui.jsx'
import { LULAV_DAYS, SHABBOS_DAY } from '../lib/succos.js'

// Admin view: a shakes-per-day grid, one row per soldier, DERIVED from the
// soldiers' own logged shake entries (see api.getSchoolReportRows). Each row is
// { id, name, grade, rank, perDay: {2:n,…,7:n}, totalShakes, totalMinutes }.
export default function ReportGrid({ rows = [] }) {
  const perDayTotal = (d) => rows.reduce((n, r) => n + (Number(r.perDay?.[d]) || 0), 0)
  const totalShakes = rows.reduce((n, r) => n + (Number(r.totalShakes) || 0), 0)
  const totalMinutes = rows.reduce((n, r) => n + (Number(r.totalMinutes) || 0), 0)

  const cell = (v) => (!v ? '—' : fmt(v)) // 0 / blank → em dash
  // header: Exo semibold navy caps on the sky card; body rows zebra in a lighter sky
  const th = 'px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-navy'
  const td = 'px-2.5 py-2'

  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center justify-between gap-2">
        <SectionHeader>Shakes each day of Sukkos</SectionHeader>
        <Pill>{rows.length} soldiers</Pill>
      </div>
      <p className="mb-4 text-xs text-muted">
        Filled in by the soldiers themselves. (Day {SHABBOS_DAY} is Shabbos — no Lulav.)
      </p>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No soldiers in this school yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[760px] border-collapse text-sm text-navy">
            <thead>
              <tr className="border-b-2 border-navy/15 text-left">
                <th className={th}>Grade</th>
                <th className={th}>Student</th>
                {LULAV_DAYS.map((d) => (
                  <th key={d} className={`${th} text-center`}>
                    <span className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">Day</span>
                    {d}
                  </th>
                ))}
                <th className={`${th} text-right`}>Total Shakes</th>
                <th className={`${th} text-right`}>Total Minutes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="odd:bg-[#ddf3ff]">
                  <td className={`${td} whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] text-muted`}>{r.grade || '—'}</td>
                  <td className={`${td} whitespace-nowrap font-semibold text-navy`}>{r.name}</td>
                  {LULAV_DAYS.map((d) => (
                    <td key={d} className={`${td} text-center tabular-nums`}>
                      {r.perDay?.[d] ? <span className="font-semibold text-green">{fmt(r.perDay[d])}</span> : <span className="text-navy/25">—</span>}
                    </td>
                  ))}
                  <td className={`${td} text-right font-semibold tabular-nums text-navy`}>{cell(r.totalShakes)}</td>
                  <td className={`${td} text-right tabular-nums`}>{cell(r.totalMinutes)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-navy/15 font-semibold text-navy">
                <td className={`${td} text-[11px] font-extrabold uppercase tracking-[0.08em] text-green`} colSpan={2}>Totals</td>
                {LULAV_DAYS.map((d) => (
                  <td key={d} className={`${td} text-center tabular-nums`}>{fmt(perDayTotal(d))}</td>
                ))}
                <td className={`${td} text-right tabular-nums`}>{fmt(totalShakes)}</td>
                <td className={`${td} text-right tabular-nums`}>{fmt(totalMinutes)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  )
}
