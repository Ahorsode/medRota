import { DollarSign } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PayrollTable } from "@/components/payroll/PayrollTable";
import { getAllowanceRates, getAllStaffPayrollSummary } from "@/lib/actions/payroll";

export const dynamic = "force-dynamic";

function searchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[]; year?: string | string[] }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const month = Number(searchValue(params.month) ?? now.getMonth() + 1);
  const year = Number(searchValue(params.year) ?? now.getFullYear());

  const [summaries, rates] = await Promise.all([getAllStaffPayrollSummary(year, month), getAllowanceRates()]);

  const totals = summaries.reduce(
    (acc, summary) => ({
      night: acc.night + summary.night_allowance,
      holiday: acc.holiday + summary.holiday_allowance,
      onCall: acc.onCall + summary.on_call_allowance,
      total: acc.total + summary.total_allowance,
    }),
    { night: 0, holiday: 0, onCall: 0, total: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Payroll & Allowances"
        description={`Shift allowance summary for ${new Date(year, month - 1).toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
        })}.`}
        actions={<DollarSign className="h-5 w-5 text-[#2E86AB]" />}
      />

      <div className="space-y-5 p-5">
        <form className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Month
            <select name="month" defaultValue={month} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
              {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {new Date(year, value - 1).toLocaleDateString("en-GB", { month: "long" })}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Year
            <input
              name="year"
              type="number"
              min={2026}
              defaultValue={year}
              className="h-10 w-28 rounded-md border border-slate-200 px-3 text-sm"
            />
          </label>
          <button type="submit" className="h-10 rounded-md bg-[#1A2B4A] px-4 text-sm font-semibold text-white">
            Apply
          </button>
        </form>

        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="Night Allowance" value={totals.night} className="border-indigo-200 bg-indigo-50 text-indigo-700" />
          <SummaryCard label="Holiday Allowance" value={totals.holiday} className="border-orange-200 bg-orange-50 text-orange-700" />
          <SummaryCard label="On-Call Allowance" value={totals.onCall} className="border-rose-200 bg-rose-50 text-rose-700" />
          <SummaryCard label="Total Payable" value={totals.total} className="border-emerald-200 bg-emerald-50 text-emerald-700" />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-700">Current Allowance Rates</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {rates.map((rate) => (
              <span key={rate.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm">
                <span className="font-mono font-bold text-[#1A2B4A]">{rate.shift_code}</span>
                <span className="ml-2 text-slate-600">GHS {rate.rate_ghs.toFixed(2)}</span>
                {rate.description ? <span className="ml-1 text-slate-400">· {rate.description}</span> : null}
              </span>
            ))}
            {rates.length === 0 ? <span className="text-sm text-slate-400">No active rates configured.</span> : null}
          </div>
        </div>

        <PayrollTable summaries={summaries} month={month} year={year} />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`rounded-lg border p-4 ${className}`}>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">GHS {value.toFixed(2)}</p>
    </div>
  );
}
