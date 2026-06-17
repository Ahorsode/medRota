"use client";

import { type FormEvent, useState } from "react";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (/^\d+$/.test(newPassword)) {
      setError("Choose a password that is not only numbers. Your staff number is not secure enough.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Session expired. Please log in again.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    const response = await fetch("/api/auth/complete-password-change", {
      method: "POST",
    });

    if (!response.ok) {
      setError("Password updated, but we could not finalize your account. Please contact IT.");
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#1A2B4A]/10">
            <ShieldCheck className="h-6 w-6 text-[#1A2B4A]" />
          </div>
          <h1 className="text-xl font-bold text-[#0F172A]">Set Your Password</h1>
          <p className="mt-1 text-sm text-slate-500">
            For your security, set a new password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            New Password
            <span className="relative mt-1 block">
              <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                id="newPassword"
                minLength={8}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 8 characters"
                required
                type="password"
                value={newPassword}
              />
            </span>
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Confirm New Password
            <span className="relative mt-1 block">
              <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                id="confirmPassword"
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </span>
          </label>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <Button className="w-full" disabled={loading} type="submit" variant="navy">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Set Password and Continue
          </Button>
        </form>
      </div>
    </main>
  );
}
