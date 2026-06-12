import Link from "next/link";
import { LockKeyhole, Mail, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
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
          <form className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Email
              <span className="relative mt-1 block">
                <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input className="pl-9" type="email" placeholder="department.head@sdahospital.org" />
              </span>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Password
              <span className="relative mt-1 block">
                <LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input className="pl-9" type="password" placeholder="••••••••" />
              </span>
            </label>
            <Button asChild className="w-full" variant="navy">
              <Link href="/dashboard">Sign in</Link>
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">Supabase Auth client is scaffolded for project keys.</p>
        </CardContent>
      </Card>
    </main>
  );
}
