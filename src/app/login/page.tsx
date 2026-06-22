"use client";

import { FormEvent, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, LockKeyhole, Mail, Stethoscope, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createLoginSession } from "@/lib/actions/sessions";
import { createClient } from "@/lib/supabase/client";
import { submitAccessRequest } from "@/lib/actions/accessRequests";
import { toast } from "sonner";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.69-2.26 1.1-3.71 1.1-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.14c-.22-.69-.35-1.42-.35-2.14s.13-1.45.35-2.14V7.02H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.98l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.02l3.66 2.84c.87-2.6 3.3-4.48 6.16-4.48z" />
  </svg>
);

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unregisteredEmail, setUnregisteredEmail] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const emailParam = searchParams.get("email");

    if (errorParam === "not_registered" && emailParam) {
      setUnregisteredEmail(emailParam);
      setError(null);
    } else if (errorParam === "auth_failed") {
      setError("Google sign-in failed. Please try again or use your password.");
    } else if (errorParam === "no_email") {
      setError("Your Google account has no email address attached.");
    }
  }, [searchParams]);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
    }
  }

  async function handleRequestAccess() {
    if (!unregisteredEmail) return;
    const result = await submitAccessRequest(unregisteredEmail);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Request sent to HR. They'll add your email and notify you.");
      setUnregisteredEmail(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      let resolvedEmail = email;

      // Handle phone login lookup: if email doesn't look like an email, assume it's a phone number.
      // Search matching staff record by phone to get their login email.
      if (email && !email.includes("@")) {
        const response = await fetch(`/api/auth/lookup-phone?phone=${encodeURIComponent(email)}`);
        if (response.ok) {
          const data = await response.json();
          if (data?.email) {
            resolvedEmail = data.email;
          }
        }
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });

      if (authError) {
        setError(authError.message || "Invalid email or password.");
        setLoading(false);
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
    <Card className="w-full max-w-md border-white/10 shadow-2xl">
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-lg bg-[#A8DADC] text-[#1A2B4A]">
          <Stethoscope className="h-7 w-7" />
        </div>
        <CardTitle className="text-2xl">MedRota</CardTitle>
        <p className="text-sm text-slate-500">Sign in to manage SDA Hospital duty rosters.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Unregistered Google email — show Request Access prompt */}
        {unregisteredEmail && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-2">
                <p>
                  <strong>{unregisteredEmail}</strong> isn&apos;t registered in MedRota.
                  Ask HR to add your email, or sign in below with your staff credentials.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRequestAccess}
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                >
                  Notify HR — Request Access
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Google Sign-In */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
        >
          {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </Button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400">or sign in with credentials</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        {/* Email/Password form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-slate-700">
            Email or Phone
            <span className="relative mt-1 block">
              <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                type="text"
                placeholder="you@sdahospital.org or 024XXXXXXX"
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
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}
          <Button className="w-full" variant="navy" type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign in
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1A2B4A] p-6">
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-white" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
