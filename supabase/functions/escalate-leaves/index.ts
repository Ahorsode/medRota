import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: stale } = await supabase
    .from("leave_requests")
    .select("*, staff(full_name, department_id)")
    .eq("status", "pending_hod")
    .lt("requested_at", cutoff);

  for (const req of stale ?? []) {
    await supabase.from("messages").insert({
      sender_id: req.staff_id,
      subject: `Leave request pending for 48hrs - ${req.staff.full_name}`,
      body: `A leave request from ${req.staff.full_name} has been awaiting your approval for over 48 hours. Please review it in the MedRota leave dashboard.`,
      message_type: "department",
      department_id: req.staff.department_id,
    });
  }

  return new Response(JSON.stringify({ escalated: stale?.length ?? 0 }), {
    headers: { "content-type": "application/json" },
  });
});
