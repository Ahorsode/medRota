import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STALE_HOURS = 48;

type StaffPayload = {
  full_name: string;
  department_id: string | null;
};

type LeavePayload = {
  id: string;
  staff_id: string | null;
  leave_type: string;
  start_date: string;
  requested_at: string;
  staff: StaffPayload | StaffPayload[] | null;
};

type UserRolePayload = {
  user_id: string;
};

type StaffRecord = {
  id: string;
  full_name: string;
};

function staffFromPayload(payload: StaffPayload | StaffPayload[] | null) {
  return Array.isArray(payload) ? payload[0] ?? null : payload;
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");

  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: "Supabase service credentials are not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("leave_requests")
    .select("id, staff_id, leave_type, start_date, requested_at, staff(full_name, department_id)")
    .eq("status", "pending_hod")
    .lt("requested_at", cutoff);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const staleLeaves = (data ?? []) as LeavePayload[];
  if (staleLeaves.length === 0) {
    return Response.json({ escalated: 0, message: "No stale requests" });
  }

  let escalated = 0;

  for (const leave of staleLeaves) {
    const staff = staffFromPayload(leave.staff);
    if (!staff?.department_id) continue;

    const { data: hodRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "department_head")
      .eq("department_id", staff.department_id)
      .limit(1)
      .maybeSingle<UserRolePayload>();

    if (!hodRole?.user_id) continue;

    const { data: hodStaff } = await supabase
      .from("staff")
      .select("id, full_name")
      .eq("user_id", hodRole.user_id)
      .limit(1)
      .maybeSingle<StaffRecord>();

    if (!hodStaff?.id) continue;

    const { data: message } = await supabase
      .from("messages")
      .insert({
        sender_id: leave.staff_id,
        subject: "Leave request pending 48 hours",
        body: `A leave request from ${staff.full_name} for ${leave.leave_type} from ${leave.start_date} has been awaiting HOD approval for over ${STALE_HOURS} hours.`,
        message_type: "direct",
      })
      .select("id")
      .single<{ id: string }>();

    if (message?.id) {
      await supabase.from("message_recipients").insert({
        message_id: message.id,
        staff_id: hodStaff.id,
      });
    }

    await supabase.from("notifications").insert({
      staff_id: hodStaff.id,
      title: "Leave request escalation",
      body: `${staff.full_name}'s ${leave.leave_type} request has been pending for over ${STALE_HOURS} hours.`,
      type: "warning",
      link: "/dashboard/leave",
    });

    await supabase.from("audit_log").insert({
      action: "leave_escalated",
      entity_type: "leave_request",
      entity_id: leave.id,
      new_value: { escalated_after_hours: STALE_HOURS, hod_staff_id: hodStaff.id },
    });

    escalated += 1;
  }

  return Response.json({ escalated, total_stale: staleLeaves.length });
});
