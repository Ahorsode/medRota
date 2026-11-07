import { DollarSign } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { AllowanceRateEditor, GeneratePayrollButton } from "@/components/payroll/PayrollControls";
import { PayrollTable } from "@/components/payroll/PayrollTable";
import { getAllowanceRates, getAllStaffPayrollSummary } from "@/lib/actions/payroll";
import { getSessionUser, isHRRole } from "@/lib/auth/getSessionUser";

export const dynamic = "force-dynamic";

function searchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[]; year?: string | string[] }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isHRRole(user.role)) redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();
  const requestedMonth = Number(searchValue(params.month));
  const requestedYear = Number(searchValue(params.year));
  const month = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : now.getMonth() + 1;
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 ? requestedYear : now.getFullYear();

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
              min={2024}
              defaultValue={year}
              className="h-10 w-28 rounded-md border border-slate-200 px-3 text-sm"
            />
          </label>
          <button type="submit" className="h-10 rounded-md bg-[#1A2B4A] px-4 text-sm font-semibold text-white">
            Apply
          </button>
          <div className="ml-auto">
            <GeneratePayrollButton month={month} year={year} hasSummaries={summaries.length > 0} />
          </div>
        </form>

        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="Night Allowance" value={totals.night} className="border-indigo-200 bg-indigo-50 text-indigo-700" />
          <SummaryCard label="Holiday Allowance" value={totals.holiday} className="border-orange-200 bg-orange-50 text-orange-700" />
          <SummaryCard label="On-Call Allowance" value={totals.onCall} className="border-rose-200 bg-rose-50 text-rose-700" />
          <SummaryCard label="Total Payable" value={totals.total} className="border-emerald-200 bg-emerald-50 text-emerald-700" />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-700">Current Allowance Rates</h2>
          <AllowanceRateEditor rates={rates} />
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
