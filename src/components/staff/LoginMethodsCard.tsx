"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KeyRound, Mail, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { validatePassword } from "@/lib/utils/passwordRules";

export function LoginMethodsCard({ staffEmail }: { staffEmail: string | null }) {
  const [identities, setIdentities] = useState<{ provider: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUserIdentities().then(({ data }) => {
      if (data?.identities) {
        setIdentities(data.identities);
      }
    });
  }, []);

  const hasGoogle = identities.some((i) => i.provider === "google");
  const hasPassword = identities.some((i) => i.provider === "email" || i.provider === "phone");

  async function handleLinkGoogle() {
    setLinkingGoogle(true);
    const supabase = createClient();
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard/my-profile` },
    });
    if (error) {
      toast.error(error.message);
      setLinkingGoogle(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validatePassword(password);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    try {
      // Clear must_change_password flag on staff record if setting a password
      await fetch("/api/auth/complete-password-change", {
        method: "POST",
      });
    } catch {
      // Safe fallback
    }

    toast.success(
      hasPassword
        ? "Password changed successfully."
        : "Password set. You can now sign in with your email/phone and password too."
    );

    setPassword("");
    setConfirmPassword("");
    setShowPasswordForm(false);
    setLoading(false);

    // Refresh identities
    const { data } = await supabase.auth.getUserIdentities();
    if (data?.identities) {
      setIdentities(data.identities);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Login Methods</CardTitle>
        <p className="text-sm text-slate-500">
          Manage how you sign in to MedRota. You can use more than one method.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email/Password Option */}
        <div className="rounded-lg border border-slate-200 p-4 transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Email & Password</p>
                <p className="text-xs text-slate-400">{staffEmail ?? "Not set"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                hasPassword ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}>
                {hasPassword ? "Active" : "Not Linked"}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowPasswordForm(!showPasswordForm)}
              >
                {hasPassword ? "Change Password" : "Set Password"}
              </Button>
            </div>
          </div>

          {showPasswordForm && (
            <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3 border-t border-slate-100 pt-3">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={hasPassword ? "New Password" : "Set Password (min 8 characters)"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setPassword("");
                    setConfirmPassword("");
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {hasPassword ? "Update Password" : "Save Password"}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Google Sign-In Option */}
        <div className="rounded-lg border border-slate-200 p-4 transition-all hover:shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Google Sign-In</p>
                <p className="text-xs text-slate-400">
                  {hasGoogle ? "Signed in with Google" : "Use Google for quicker, passwordless logins"}
                </p>
              </div>
            </div>
            <div>
              {hasGoogle ? (
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                  Connected
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLinkGoogle}
                  disabled={linkingGoogle}
                >
                  {linkingGoogle && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Connect Google
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
