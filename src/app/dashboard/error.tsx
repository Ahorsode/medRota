"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-2xl font-extrabold text-slate-950">Something went wrong</h2>
      <p className="max-w-md text-sm text-slate-500">The roster workspace could not load. Try again or check the connected Supabase project.</p>
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
