import { fmt } from '../lib/format.js'
import { Card, SectionHeader, Pill } from './ui.jsx'

const DAYS = [1, 2, 3, 4, 6, 7]

// Admin view: the teacher-checklist grid, one row per soldier, filled in from
// the kids' own Succos reports.
export default function ReportGrid({ kids, reports }) {
  const byKid = Object.fromEntries((reports || []).map((r) => [r.kidId, r]))
  const rows = [...(kids || [])].sort(
    (a, b) => String(a.grade || '').localeCompare(String(b.grade || '')) ||
      String(a.lastName || '').localeCompare(String(b.lastName || '')),
  )
  const reportedCount = rows.filter((k) => byKid[k.id]).length
  const sum = (f) => (reports || []).reduce((n, r) => n + (Number(r[f]) || 0), 0)

  const num = (v) => (v === null || v === undefined || v === '' ? '—' : fmt(v))
  // header: Exo semibold navy caps on the sky card; body rows zebra in a lighter sky
  const th = 'px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-navy'
  const td = 'px-2.5 py-2'

  return (
    <Card className="p-6" topColor="var(--color-cyan)">
      <div className="mb-1 flex items-center justify-between gap-2">
        <SectionHeader>Mivtza Lulav Report</SectionHeader>
        <Pill>{reportedCount}/{rows.length} reported</Pill>
      </div>
      <p className="mb-4 text-xs text-muted">
        Filled in by the soldiers themselves. ✓ = went on Mivtza Lulav that day of Succos.
      </p>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No soldiers in this school yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[760px] border-collapse text-sm text-navy">
            <thead>
              <tr className="text-left">
                <th className={th}>Grade</th>
                <th className={th}>Student</th>
                <th className={`${th} text-center`} colSpan={DAYS.length}>Days on Mivtza Lulav</th>
                <th className={`${th} text-right`}>Min</th>
                <th className={`${th} text-right`}>w/ Friends</th>
                <th className={`${th} text-right`}>Personally</th>
              </tr>
              <tr className="border-b-2 border-navy/15">
                <th /><th />
                {DAYS.map((d) => <th key={d} className={`${th} pt-0 text-center`}>{d}</th>)}
                <th /><th /><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((k) => {
                const r = byKid[k.id]
                return (
                  <tr key={k.id} className={`odd:bg-[#ddf3ff] ${r ? '' : 'text-muted/60'}`}>
                    <td className={`${td} whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] text-muted`}>{k.grade || '—'}</td>
                    <td className={`${td} whitespace-nowrap font-semibold text-navy`}>{k.firstName} {k.lastName}</td>
                    {DAYS.map((d) => (
                      <td key={d} className={`${td} text-center`}>
                        {r?.days?.includes(d) ? <span className="font-bold text-green">✓</span> : <span className="text-navy/25">·</span>}
                      </td>
                    ))}
                    <td className={`${td} text-right tabular-nums`}>{num(r?.minutes)}</td>
                    <td className={`${td} text-right tabular-nums`}>{num(r?.peopleWithFriends)}</td>
                    <td className={`${td} text-right font-semibold tabular-nums text-navy`}>{num(r?.peoplePersonal)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-navy/15 font-semibold text-navy">
                <td className={`${td} text-[11px] font-extrabold uppercase tracking-[0.08em] text-green`} colSpan={2 + DAYS.length}>Totals</td>
                <td className={`${td} text-right tabular-nums`}>{fmt(sum('minutes'))}</td>
                <td className={`${td} text-right tabular-nums`}>{fmt(sum('peopleWithFriends'))}</td>
                <td className={`${td} text-right tabular-nums`}>{fmt(sum('peoplePersonal'))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  )
}
