import { Send } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDepartments } from "@/lib/actions/departments";
import { getMessages, markMessageRead, sendMessage } from "@/lib/actions/messages";
import { getStaff } from "@/lib/actions/staff";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const departmentFilter = user.role === "department_head" ? user.departmentId ?? undefined : undefined;
  const [staff, allDepartments] = await Promise.all([getStaff(departmentFilter), getDepartments()]);
  const departments = departmentFilter ? allDepartments.filter((department) => department.id === departmentFilter) : allDepartments;
  const currentStaff = user.staffRecord ? staff.find((person) => person.id === user.staffRecord?.id) ?? null : staff[0] ?? null;
  const messages = currentStaff ? await getMessages(currentStaff.id) : [];

  async function compose(formData: FormData) {
    "use server";

    const senderId = String(formData.get("sender_id") ?? "");
    const recipientIds = formData.getAll("recipient_ids").map(String).filter(Boolean);
    const departmentId = String(formData.get("department_id") ?? "");
    const body = String(formData.get("body") ?? "");

    if (!senderId || recipientIds.length === 0 || !body.trim()) return;

    await sendMessage({
      sender_id: senderId,
      subject: String(formData.get("subject") ?? "") || undefined,
      body,
      recipient_ids: recipientIds,
      message_type: departmentId ? "department" : "direct",
      department_id: departmentId || undefined,
    });
  }

  return (
    <div>
      <PageHeader title="Messages" description="Internal communication for direct, department, and broadcast updates." />
      <div className="grid gap-5 p-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Compose</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={compose} className="grid gap-3">
              <input type="hidden" name="sender_id" value={currentStaff?.id ?? ""} />
              <select name="recipient_ids" multiple className="min-h-32 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name}
                  </option>
                ))}
              </select>
              <select name="department_id" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" defaultValue="">
                <option value="">Direct message</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <input name="subject" className="h-10 rounded-md border border-slate-200 px-3 text-sm" placeholder="Subject" />
              <textarea name="body" className="min-h-36 rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Message body" required />
              <Button type="submit" disabled={!currentStaff}>
                <Send className="h-4 w-4" />
                Send
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inbox</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {messages.length > 0 ? (
              messages.map((message) => {
                const unread = message.recipients?.some((recipient) => recipient.staff_id === currentStaff?.id && !recipient.is_read);
                return (
                  <article key={message.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-950">{message.subject ?? "No subject"}</p>
                        <p className="text-xs text-slate-500">
                          {message.sender?.full_name ?? "Unknown sender"} · {new Date(message.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {unread ? <Badge variant="blue">Unread</Badge> : <Badge>Read</Badge>}
                        {unread && currentStaff ? (
                          <form
                            action={async () => {
                              "use server";
                              await markMessageRead(message.id, currentStaff.id);
                            }}
                          >
                            <Button type="submit" size="sm" variant="ghost" className="text-slate-500">
                              Mark read
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{message.body}</p>
                  </article>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">No messages yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
