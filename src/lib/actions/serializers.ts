import type {
  AllowanceRate,
  AuditLog,
  AttendanceRecord,
  Department,
  HandoverReport,
  LeaveRequest,
  LoginSession,
  LocumShift,
  Message,
  MessageRecipient,
  Notification,
  PayrollSummary,
  Roster,
  RosterEntry,
  ShiftConfiguration,
  ShiftSwap,
  Staff,
  StaffAssessment,
  TrainingRecord,
  AccessRequest,
} from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";

type Dateish = Date | string | null | undefined;
type Decimalish = Prisma.Decimal | number;
type DbDepartment = Omit<Department, "department_type" | "created_at" | "children"> & {
  department_type: string;
  created_at: Dateish;
  children?: DbDepartment[];
};
type DbStaff = Omit<
  Staff,
  | "login_identifier_type"
  | "created_at"
  | "invited_at"
  | "password_changed_at"
  | "first_login_at"
  | "department"
  | "leave_requests"
  | "attendance_records"
  | "assessments"
  | "training_records"
  | "payroll_summaries"
  | "notifications"
> & {
  login_identifier_type: string;
  created_at: Dateish;
  invited_at: Dateish;
  password_changed_at: Dateish;
  first_login_at: Dateish;
  department?: DbDepartment | null;
  leave_requests?: DbLeaveRequest[];
  attendance_records?: DbAttendanceRecord[];
  assessments?: DbStaffAssessment[];
  training_records?: DbTrainingRecord[];
  payroll_summaries?: DbPayrollSummary[];
  notifications?: DbNotification[];
};
type DbRoster = Omit<
  Roster,
  | "status"
  | "created_at"
  | "published_at"
  | "department"
  | "entries"
  | "signatures"
  | "hod_signed_at"
  | "hod_signed_by"
  | "director_signed_at"
  | "director_signed_by"
> & {
  status: string;
  created_at: Dateish;
  published_at: Dateish;
  signatures?: unknown;
  hod_signed_at?: Dateish;
  hod_signed_by?: string | null;
  director_signed_at?: Dateish;
  director_signed_by?: string | null;
  department?: DbDepartment | null;
  entries?: DbRosterEntry[];
};
type DbRosterEntry = Omit<RosterEntry, "shift_code" | "shift_date" | "created_at" | "updated_at"> & {
  shift_code: string;
  shift_date: Dateish;
  created_at: Dateish;
  updated_at: Dateish;
};
type DbShiftConfiguration = Omit<ShiftConfiguration, "shift_code" | "start_time" | "end_time"> & {
  shift_code: string;
  start_time: Dateish;
  end_time: Dateish;
};
type DbLeaveRequest = Omit<
  LeaveRequest,
  "status" | "start_date" | "end_date" | "requested_at" | "hod_reviewed_at" | "reviewed_at" | "staff"
> & {
  status: string;
  start_date: Dateish;
  end_date: Dateish;
  requested_at: Dateish;
  hod_reviewed_at: Dateish;
  reviewed_at: Dateish;
  staff?: DbStaff | null;
};
type DbShiftSwap = Omit<ShiftSwap, "status" | "requested_at" | "requester" | "replacement" | "requester_entry" | "replacement_entry"> & {
  status: string;
  requested_at: Dateish;
  requester?: DbStaff | null;
  replacement?: DbStaff | null;
  requester_entry?: DbRosterEntry | null;
  replacement_entry?: DbRosterEntry | null;
};
type DbAttendanceRecord = Omit<AttendanceRecord, "status" | "shift_date" | "clock_in" | "clock_out" | "created_at" | "staff"> & {
  status: string;
  shift_date: Dateish;
  clock_in: Dateish;
  clock_out: Dateish;
  created_at: Dateish;
  staff?: DbStaff | null;
};
type DbMessageRecipient = Omit<MessageRecipient, "read_at" | "staff"> & { read_at: Dateish; staff?: DbStaff | null };
type DbMessage = Omit<Message, "message_type" | "created_at" | "sender" | "recipients"> & {
  message_type: string;
  created_at: Dateish;
  sender?: DbStaff | null;
  recipients?: DbMessageRecipient[];
};
type DbHandoverReport = Omit<HandoverReport, "shift_date" | "acknowledged_at" | "created_at" | "from_staff" | "to_staff"> & {
  shift_date: Dateish;
  acknowledged_at: Dateish;
  created_at: Dateish;
  from_staff?: DbStaff | null;
  to_staff?: DbStaff | null;
};
type DbStaffAssessment = Omit<StaffAssessment, "assessment_date" | "created_at" | "staff"> & {
  assessment_date: Dateish;
  created_at: Dateish;
  staff?: DbStaff | null;
};
type DbTrainingRecord = Omit<TrainingRecord, "training_type" | "start_date" | "end_date" | "created_at" | "staff"> & {
  training_type: string;
  start_date: Dateish;
  end_date: Dateish;
  created_at: Dateish;
  staff?: DbStaff | null;
};
type DbLoginSession = Omit<LoginSession, "login_at" | "logout_at" | "staff"> & {
  login_at: Dateish;
  logout_at: Dateish;
  staff?: DbStaff | null;
};
type DbAuditLog = Omit<AuditLog, "created_at" | "old_value" | "new_value"> & {
  created_at: Dateish;
  old_value?: unknown;
  new_value?: unknown;
};
type DbAllowanceRate = Omit<AllowanceRate, "rate_ghs" | "effective_from" | "created_at"> & {
  rate_ghs: Decimalish;
  effective_from: Dateish;
  created_at: Dateish;
};
type DbPayrollSummary = Omit<
  PayrollSummary,
  | "night_allowance"
  | "weekend_allowance"
  | "holiday_allowance"
  | "on_call_allowance"
  | "total_allowance"
  | "generated_at"
  | "staff"
> & {
  night_allowance: Decimalish;
  weekend_allowance: Decimalish;
  holiday_allowance: Decimalish;
  on_call_allowance: Decimalish;
  total_allowance: Decimalish;
  generated_at: Dateish;
  staff?: DbStaff | null;
};
type DbLocumShift = Omit<LocumShift, "status" | "shift_code" | "shift_date" | "created_at" | "department" | "filled_staff"> & {
  status: string;
  shift_code: string;
  shift_date: Dateish;
  created_at: Dateish;
  department?: DbDepartment | null;
  filled_staff?: DbStaff | null;
};
type DbNotification = Omit<Notification, "type" | "created_at" | "read_at"> & {
  type: string;
  created_at: Dateish;
  read_at: Dateish;
};

function dateTime(value: Dateish) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

function dateOnly(value: Dateish) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value ?? "";
}

function toNumber(value: Decimalish | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

function recordFromJson(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function signatureList(value: unknown): Roster["signatures"] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is { role: string; name: string; user_id?: string; signed_at: string } => {
      return (
        typeof item === "object" &&
        item !== null &&
        "role" in item &&
        "name" in item &&
        "signed_at" in item &&
        typeof item.role === "string" &&
        typeof item.name === "string" &&
        typeof item.signed_at === "string" &&
        (!("user_id" in item) || typeof item.user_id === "string")
      );
    });
}

export function serializeDepartment(department: DbDepartment): Department {
  return {
    ...department,
    department_type: department.department_type as Department["department_type"],
    created_at: dateTime(department.created_at) ?? "",
    children: department.children?.map(serializeDepartment),
  };
}

export function serializeStaff(staff: DbStaff): Staff {
  return {
    ...staff,
    login_identifier_type: (staff.login_identifier_type as Staff["login_identifier_type"]) || "email",
    created_at: dateTime(staff.created_at) ?? "",
    invited_at: dateTime(staff.invited_at),
    password_changed_at: dateTime(staff.password_changed_at),
    first_login_at: dateTime(staff.first_login_at),
    department: staff.department ? serializeDepartment(staff.department) : undefined,
    leave_requests: staff.leave_requests?.map(serializeLeaveRequest),
    attendance_records: staff.attendance_records?.map(serializeAttendanceRecord),
    assessments: staff.assessments?.map(serializeStaffAssessment),
    training_records: staff.training_records?.map(serializeTrainingRecord),
    payroll_summaries: staff.payroll_summaries?.map(serializePayrollSummary),
    notifications: staff.notifications?.map(serializeNotification),
  };
}

export function serializeRoster(roster: DbRoster): Roster {
  return {
    ...roster,
    status: roster.status as Roster["status"],
    signatures: signatureList(roster.signatures),
    created_at: dateTime(roster.created_at) ?? "",
    published_at: dateTime(roster.published_at),
    hod_signed_at: dateTime(roster.hod_signed_at),
    hod_signed_by: roster.hod_signed_by,
    director_signed_at: dateTime(roster.director_signed_at),
    director_signed_by: roster.director_signed_by,
    department: roster.department ? serializeDepartment(roster.department) : undefined,
    entries: roster.entries?.map(serializeRosterEntry),
  };
}

export function serializeRosterEntry(entry: DbRosterEntry): RosterEntry {
  return {
    ...entry,
    shift_code: entry.shift_code as RosterEntry["shift_code"],
    shift_date: dateOnly(entry.shift_date),
    created_at: dateTime(entry.created_at) ?? "",
    updated_at: dateTime(entry.updated_at) ?? "",
  };
}

export function serializeShiftConfiguration(config: DbShiftConfiguration): ShiftConfiguration {
  return {
    ...config,
    shift_code: config.shift_code as ShiftConfiguration["shift_code"],
    start_time: dateTime(config.start_time),
    end_time: dateTime(config.end_time),
  };
}

export function serializeLeaveRequest(request: DbLeaveRequest): LeaveRequest {
  return {
    ...request,
    status: request.status as LeaveRequest["status"],
    start_date: dateOnly(request.start_date),
    end_date: dateOnly(request.end_date),
    requested_at: dateTime(request.requested_at) ?? "",
    hod_reviewed_at: dateTime(request.hod_reviewed_at),
    reviewed_at: dateTime(request.reviewed_at),
    staff: request.staff ? serializeStaff(request.staff) : undefined,
  };
}

export function serializeShiftSwap(swap: DbShiftSwap): ShiftSwap {
  return {
    ...swap,
    status: swap.status as ShiftSwap["status"],
    requested_at: dateTime(swap.requested_at) ?? "",
    requester: swap.requester ? serializeStaff(swap.requester) : undefined,
    replacement: swap.replacement ? serializeStaff(swap.replacement) : undefined,
    requester_entry: swap.requester_entry ? serializeRosterEntry(swap.requester_entry) : undefined,
    replacement_entry: swap.replacement_entry ? serializeRosterEntry(swap.replacement_entry) : undefined,
  };
}

export function serializeAttendanceRecord(record: DbAttendanceRecord): AttendanceRecord {
  return {
    ...record,
    status: record.status as AttendanceRecord["status"],
    shift_date: dateOnly(record.shift_date),
    clock_in: dateTime(record.clock_in),
    clock_out: dateTime(record.clock_out),
    created_at: dateTime(record.created_at) ?? "",
    staff: record.staff ? serializeStaff(record.staff) : undefined,
  };
}

export function serializeMessage(message: DbMessage): Message {
  return {
    ...message,
    message_type: message.message_type as Message["message_type"],
    created_at: dateTime(message.created_at) ?? "",
    sender: message.sender ? serializeStaff(message.sender) : undefined,
    recipients: message.recipients?.map(serializeMessageRecipient),
  };
}

export function serializeMessageRecipient(recipient: DbMessageRecipient): MessageRecipient {
  return {
    ...recipient,
    read_at: dateTime(recipient.read_at),
    staff: recipient.staff ? serializeStaff(recipient.staff) : undefined,
  };
}

export function serializeHandoverReport(report: DbHandoverReport): HandoverReport {
  return {
    ...report,
    shift_date: dateOnly(report.shift_date),
    acknowledged_at: dateTime(report.acknowledged_at),
    created_at: dateTime(report.created_at) ?? "",
    from_staff: report.from_staff ? serializeStaff(report.from_staff) : undefined,
    to_staff: report.to_staff ? serializeStaff(report.to_staff) : undefined,
  };
}

export function serializeStaffAssessment(assessment: DbStaffAssessment): StaffAssessment {
  return {
    ...assessment,
    assessment_date: dateOnly(assessment.assessment_date),
    created_at: dateTime(assessment.created_at) ?? "",
    staff: assessment.staff ? serializeStaff(assessment.staff) : undefined,
  };
}

export function serializeTrainingRecord(record: DbTrainingRecord): TrainingRecord {
  return {
    ...record,
    training_type: record.training_type as TrainingRecord["training_type"],
    start_date: dateOnly(record.start_date),
    end_date: dateOnly(record.end_date),
    created_at: dateTime(record.created_at) ?? "",
    staff: record.staff ? serializeStaff(record.staff) : undefined,
  };
}

export function serializeLoginSession(session: DbLoginSession): LoginSession {
  return {
    ...session,
    login_at: dateTime(session.login_at) ?? "",
    logout_at: dateTime(session.logout_at),
    staff: session.staff ? serializeStaff(session.staff) : undefined,
  };
}

export function serializeAuditLog(log: DbAuditLog): AuditLog {
  return {
    ...log,
    old_value: recordFromJson(log.old_value),
    new_value: recordFromJson(log.new_value),
    created_at: dateTime(log.created_at) ?? "",
  };
}

export function serializeAllowanceRate(rate: DbAllowanceRate): AllowanceRate {
  return {
    ...rate,
    rate_ghs: toNumber(rate.rate_ghs),
    effective_from: dateOnly(rate.effective_from),
    created_at: dateTime(rate.created_at) ?? "",
  };
}

export function serializePayrollSummary(summary: DbPayrollSummary): PayrollSummary {
  return {
    ...summary,
    night_allowance: toNumber(summary.night_allowance),
    weekend_allowance: toNumber(summary.weekend_allowance),
    holiday_allowance: toNumber(summary.holiday_allowance),
    on_call_allowance: toNumber(summary.on_call_allowance),
    total_allowance: toNumber(summary.total_allowance),
    generated_at: dateTime(summary.generated_at) ?? "",
    staff: summary.staff ? serializeStaff(summary.staff) : undefined,
  };
}

export function serializeLocumShift(shift: DbLocumShift): LocumShift {
  return {
    ...shift,
    status: shift.status as LocumShift["status"],
    shift_code: shift.shift_code as LocumShift["shift_code"],
    shift_date: dateOnly(shift.shift_date),
    created_at: dateTime(shift.created_at) ?? "",
    department: shift.department ? serializeDepartment(shift.department) : undefined,
    filled_staff: shift.filled_staff ? serializeStaff(shift.filled_staff) : undefined,
  };
}

export function serializeNotification(notification: DbNotification): Notification {
  return {
    ...notification,
    type: notification.type as Notification["type"],
    read_at: dateTime(notification.read_at),
    created_at: dateTime(notification.created_at) ?? "",
  };
}

type DbAccessRequest = Omit<AccessRequest, "status" | "created_at" | "resolved_at"> & {
  status: string;
  created_at: Dateish;
  resolved_at: Dateish;
};

export function serializeAccessRequest(req: DbAccessRequest): AccessRequest {
  return {
    ...req,
    status: req.status as AccessRequest["status"],
    created_at: dateTime(req.created_at) ?? "",
    resolved_at: dateTime(req.resolved_at),
  };
}
