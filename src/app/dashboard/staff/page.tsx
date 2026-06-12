"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StaffForm } from "@/components/staff/StaffForm";
import { StaffTable } from "@/components/staff/StaffTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { departments, staff as initialStaff } from "@/lib/data/mock";

export default function StaffPage() {
  const [staff, setStaff] = useState(initialStaff);

  return (
    <div>
      <PageHeader title="Staff Management" description="Search, filter, add, edit, and deactivate hospital staff." actions={<Button><Plus className="h-4 w-4" />Add Staff</Button>} />
      <div className="space-y-5 p-5">
        <Card>
          <CardHeader>
            <CardTitle>Quick Add</CardTitle>
          </CardHeader>
          <CardContent>
            <StaffForm departments={departments} onAdd={(newStaff) => setStaff((current) => [newStaff, ...current])} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <StaffTable staff={staff} departments={departments} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
