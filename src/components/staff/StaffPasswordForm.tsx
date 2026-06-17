"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function StaffPasswordForm() {
  const [loading, setLoading] = useState(false);

  async function updatePassword(formData: FormData) {
    const password = String(formData.get("password") ?? "");
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password updated.");
  }

  return (
    <form action={updatePassword} className="flex flex-col gap-3 sm:flex-row">
      <input name="password" type="password" minLength={8} className="h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm" placeholder="New password" required />
      <Button type="submit" disabled={loading}>
        {loading ? "Updating..." : "Change Password"}
      </Button>
    </form>
  );
}
