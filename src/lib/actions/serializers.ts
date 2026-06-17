import type {
  AttendanceRecord,
  Department,
  HandoverReport,
  LeaveRequest,
  LoginSession,
  Message,
  MessageRecipient,
  Roster,
  RosterEntry,
  ShiftConfiguration,
  ShiftSwap,
  Staff,
  StaffAssessment,
  TrainingRecord,
} from "@/lib/types";

type Dateish = Date | string | null | undefined;
type DbDepartment = Omit<Department, "department_type" | "created_at" | "children"> & {
  department_type: string;
  created_at: Dateish;
  children?: DbDepartment[];
};
type DbStaff = Omit<Staff, "created_at" | "department" | "leave_requests" | "attendance_records" | "assessments" | "training_records"> & {
  created_at: Dateish;
  department?: DbDepartment | null;
  leave_requests?: DbLeaveRequest[];
  attendance_records?: DbAttendanceRecord[];
  assessments?: DbStaffAssessment[];
  training_records?: DbTrainingRecord[];
};
type DbRoster = Omit<
  Roster,
  "status" | "created_at" | "published_at" | "department" | "entries" | "signatures" | "hod_signed_at" | "director_signed_at"
> & {
  status: string;
  created_at: Dateish;
  published_at: Dateish;
  signatures?: unknown;
  hod_signed_at?: Dateish;
  director_signed_at?: Dateish;
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

function dateTime(value: Dateish) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

function dateOnly(value: Dateish) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value ?? "";
}

function signatureList(value: unknown): Roster["signatures"] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is { role: string; name: string; signed_at: string } => {
      return (
        typeof item === "object" &&
        item !== null &&
        "role" in item &&
        "name" in item &&
        "signed_at" in item &&
        typeof item.role === "string" &&
        typeof item.name === "string" &&
        typeof item.signed_at === "string"
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
    created_at: dateTime(staff.created_at) ?? "",
    department: staff.department ? serializeDepartment(staff.department) : undefined,
    leave_requests: staff.leave_requests?.map(serializeLeaveRequest),
    attendance_records: staff.attendance_records?.map(serializeAttendanceRecord),
    assessments: staff.assessments?.map(serializeStaffAssessment),
    training_records: staff.training_records?.map(serializeTrainingRecord),
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
    director_signed_at: dateTime(roster.director_signed_at),
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
