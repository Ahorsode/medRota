"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateAllPayrollSummaries, updateAllowanceRate } from "@/lib/actions/payroll";
import type { AllowanceRate } from "@/lib/types";

export function GeneratePayrollButton({ month, year, hasSummaries }: { month: number; year: number; hasSummaries: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateAllPayrollSummaries(year, month);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Generated ${result.generated} payroll summar${result.generated === 1 ? "y" : "ies"}` +
          (result.failed ? ` · ${result.failed} failed` : ""),
      );
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="navy" onClick={handleGenerate} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      {hasSummaries ? "Regenerate Summaries" : "Generate Summaries"}
    </Button>
  );
}

export function AllowanceRateEditor({ rates }: { rates: AllowanceRate[] }) {
  if (rates.length === 0) {
    return <span className="text-sm text-slate-400">No active rates configured.</span>;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {rates.map((rate) => (
        <RateRow key={rate.id} rate={rate} />
      ))}
    </div>
  );
}

function RateRow({ rate }: { rate: AllowanceRate }) {
  const router = useRouter();
  const [value, setValue] = useState(rate.rate_ghs.toFixed(2));
  const [pending, startTransition] = useTransition();
  const dirty = Number(value) !== rate.rate_ghs;

  function handleSave() {
    startTransition(async () => {
      const result = await updateAllowanceRate(rate.id, Number(value));
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`${rate.shift_code} rate updated to GHS ${result.rate_ghs.toFixed(2)}`);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm">
      <span className="font-mono font-bold text-[#1A2B4A]">{rate.shift_code}</span>
      <span className="text-slate-500">GHS</span>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label={`${rate.shift_code} allowance rate`}
        className="h-8 w-20 rounded border border-slate-200 bg-white px-2 text-sm"
      />
      {rate.description ? <span className="text-slate-400">· {rate.description}</span> : null}
      <Button type="button" size="sm" variant="outline" onClick={handleSave} disabled={!dirty || pending} aria-label={`Save ${rate.shift_code} rate`}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
