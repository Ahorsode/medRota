export type UUID = string;

export type RosterStatus = "draft" | "submitted" | "approved" | "hod_signed" | "director_signed" | "published";
export type ShiftCode = "M" | "A" | "N" | "O" | "H" | "%" | "LEAVE" | "ON_CALL";
export type LeaveStatus = "pending_hod" | "pending_hr" | "approved" | "rejected_hod" | "rejected_hr";
export type SwapStatus = "pending" | "approved" | "rejected";
export type DepartmentType = "department" | "unit" | "special_clinic" | "autonomous_centre";
export type NotificationType = "info" | "success" | "warning" | "error" | "leave" | "roster" | "swap" | "message";

export interface Hospital {
  id: UUID;
  name: string;
  location: string | null;
  created_at: string;
}

export interface Department {
  id: UUID;
  hospital_id: UUID | null;
  name: string;
  description: string | null;
  is_active: boolean;
  department_type: DepartmentType;
  parent_id: UUID | null;
  created_at: string;
  children?: Department[];
  _count?: {
    staff: number;
    rosters: number;
  };
}

export interface ShiftConfiguration {
  id: UUID;
  department_id: UUID | null;
  shift_code: ShiftCode;
  shift_name: string;
  start_time: string | null;
  end_time: string | null;
  color_class: string | null;
  is_active: boolean;
}

export interface Staff {
  id: UUID;
  hospital_id: UUID | null;
  department_id: UUID | null;
  user_id: UUID | null;
  staff_number: string | null;
  full_name: string;
  rank: string | null;
  position: string | null;
  employment_type: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  must_change_password: boolean;
  invited_at: string | null;
  password_changed_at: string | null;
  department?: Department | null;
  leave_requests?: LeaveRequest[];
  attendance_records?: AttendanceRecord[];
  assessments?: StaffAssessment[];
  training_records?: TrainingRecord[];
  payroll_summaries?: PayrollSummary[];
  notifications?: Notification[];
}

export interface Roster {
  id: UUID;
  department_id: UUID | null;
  month: number;
  year: number;
  status: RosterStatus;
  created_by: UUID | null;
  approved_by: UUID | null;
  signatures?: Array<{ role: string; name: string; user_id?: UUID; signed_at: string }>;
  hod_signed_at?: string | null;
  hod_signed_by?: UUID | null;
  director_signed_at?: string | null;
  director_signed_by?: UUID | null;
  created_at: string;
  published_at: string | null;
  department?: Department | null;
  entries?: RosterEntry[];
  _count?: {
    entries: number;
  };
}

export interface RosterEntry {
  id: UUID;
  roster_id: UUID | null;
  staff_id: UUID | null;
  shift_date: string;
  shift_code: ShiftCode;
  shift_config_id: UUID | null;
  notes: string | null;
  is_leave: boolean;
  leave_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: UUID;
  staff_id: UUID | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveStatus;
  requested_at: string;
  hod_reviewed_by: UUID | null;
  hod_reviewed_at: string | null;
  hod_notes: string | null;
  reviewed_by: UUID | null;
  reviewed_at: string | null;
  notes: string | null;
  staff?: Staff | null;
}

export interface ShiftSwap {
  id: UUID;
  requester_id: UUID | null;
  replacement_id: UUID | null;
  requester_entry_id: UUID | null;
  replacement_entry_id: UUID | null;
  status: SwapStatus;
  requested_at: string;
  reviewed_by: UUID | null;
  requester?: Staff | null;
  replacement?: Staff | null;
  requester_entry?: RosterEntry | null;
  replacement_entry?: RosterEntry | null;
}

export interface UserRole {
  id: UUID;
  user_id: UUID;
  role: "admin" | "medical_director" | "department_head" | "doctor" | "nurse" | "hr_officer" | "staff";
  department_id: UUID | null;
}

export interface DaySummary {
  date: string;
  M: number;
  A: number;
  N: number;
  O: number;
  H: number;
  "%": number;
  LEAVE: number;
  ON_CALL: number;
}

export interface Conflict {
  staffId: UUID;
  date: string;
  reason: string;
}

export interface LeaveSpanSegment {
  staffId: UUID;
  startDate: string;
  endDate: string;
  startDay: number;
  length: number;
  label: string;
}

export interface AttendanceRecord {
  id: UUID;
  staff_id: UUID | null;
  shift_date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: "present" | "absent" | "late" | "early_departure";
  notes: string | null;
  created_at: string;
  staff?: Staff | null;
}

export interface Message {
  id: UUID;
  sender_id: UUID | null;
  subject: string | null;
  body: string;
  message_type: "direct" | "broadcast" | "department";
  department_id: UUID | null;
  created_at: string;
  sender?: Staff | null;
  recipients?: MessageRecipient[];
}

export interface MessageRecipient {
  id: UUID;
  message_id: UUID | null;
  staff_id: UUID | null;
  is_read: boolean;
  read_at: string | null;
  staff?: Staff | null;
}

export interface HandoverReport {
  id: UUID;
  department_id: UUID | null;
  shift_date: string;
  shift_code: string;
  from_staff_id: UUID | null;
  to_staff_id: UUID | null;
  report_body: string;
  patients_count: number | null;
  critical_notes: string | null;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
  from_staff?: Staff | null;
  to_staff?: Staff | null;
}

export interface StaffAssessment {
  id: UUID;
  staff_id: UUID | null;
  assessed_by: UUID | null;
  assessment_date: string;
  period: string;
  competency_score: number | null;
  efficiency_score: number | null;
  professionalism_score: number | null;
  ethical_score: number | null;
  overall_score: number | null;
  comments: string | null;
  created_at: string;
  staff?: Staff | null;
}

export interface TrainingRecord {
  id: UUID;
  staff_id: UUID | null;
  training_title: string;
  training_type: "given" | "attended";
  provider: string | null;
  start_date: string;
  end_date: string;
  certificate_url: string | null;
  notes: string | null;
  created_at: string;
  staff?: Staff | null;
}

export interface LoginSession {
  id: UUID;
  user_id: UUID;
  staff_id: UUID | null;
  login_at: string;
  logout_at: string | null;
  duration_minutes: number | null;
  ip_address: string | null;
  device: string | null;
  staff?: Staff | null;
}

export interface ShiftAllowanceSummary {
  nightShifts: number;
  holidayShifts: number;
  weekendShifts: number;
  nightAllowance: number;
  holidayAllowance: number;
  weekendAllowance: number;
  total: number;
}

export interface AuditLog {
  id: UUID;
  user_id: UUID | null;
  staff_id: UUID | null;
  action: string;
  entity_type: string;
  entity_id: UUID | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AllowanceRate {
  id: UUID;
  hospital_id: UUID | null;
  shift_code: string;
  rate_ghs: number;
  effective_from: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  notes: string | null;
}

export interface PayrollSummary {
  id: UUID;
  staff_id: UUID | null;
  month: number;
  year: number;
  morning_shifts: number;
  afternoon_shifts: number;
  night_shifts: number;
  weekend_shifts: number;
  holiday_shifts: number;
  on_call_shifts: number;
  total_shifts: number;
  leave_days: number;
  absent_days: number;
  night_allowance: number;
  weekend_allowance: number;
  holiday_allowance: number;
  on_call_allowance: number;
  total_allowance: number;
  generated_at: string;
  staff?: Staff | null;
}

export interface LocumShift {
  id: UUID;
  department_id: UUID | null;
  shift_date: string;
  shift_code: ShiftCode;
  requirements: string | null;
  status: "open" | "filled" | "cancelled";
  filled_by: UUID | null;
  posted_by: UUID | null;
  created_at: string;
  department?: Department | null;
  filled_staff?: Staff | null;
}

export interface Notification {
  id: UUID;
  staff_id: UUID | null;
  title: string;
  body: string | null;
  type: NotificationType;
  is_read: boolean;
  read_at: string | null;
  link: string | null;
  created_at: string;
}
