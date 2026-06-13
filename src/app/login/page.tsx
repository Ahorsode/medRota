"use client";

import { FormEvent, useState } from "react";
import { Loader2, LockKeyhole, Mail, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createLoginSession } from "@/lib/actions/sessions";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await createClient().auth.signInWithPassword({ email, password });

      if (authError) {
        setError(authError.message || "Invalid email or password.");
        return;
      }

      if (data.user) {
        try {
          const loginSession = await createLoginSession({ user_id: data.user.id });
          if ("id" in loginSession) {
            window.localStorage.setItem("medrota_login_session_id", loginSession.id);
          }
        } catch {
          // Session logging should not block login.
        }
      }

      window.location.href = "/dashboard";
    } catch {
      setError("Supabase environment keys are missing. Add them to .env.local to enable login.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1A2B4A] p-6">
      <Card className="w-full max-w-md border-white/10 shadow-2xl">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-lg bg-[#A8DADC] text-[#1A2B4A]">
            <Stethoscope className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">MedRota</CardTitle>
          <p className="text-sm text-slate-500">Sign in to manage SDA Hospital duty rosters.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold text-slate-700">
              Email
              <span className="relative mt-1 block">
                <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  type="email"
                  placeholder="department.head@sdahospital.org"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </span>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Password
              <span className="relative mt-1 block">
                <LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </span>
            </label>
            {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
            <Button className="w-full" variant="navy" type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign in
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">Uses Supabase email/password authentication.</p>
        </CardContent>
      </Card>
    </main>
  );
}
