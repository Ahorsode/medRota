export type UUID = string;

export type RosterStatus = "draft" | "submitted" | "approved" | "published";
export type ShiftCode = "M" | "A" | "N" | "O" | "H" | "%" | "LEAVE";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type SwapStatus = "pending" | "approved" | "rejected";

export interface Hospital {
  id: UUID;
  name: string;
  location: string | null;
  created_at: string;
}

export interface Department {
  id: UUID;
  hospital_id: UUID;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ShiftConfiguration {
  id: UUID;
  department_id: UUID;
  shift_code: ShiftCode;
  shift_name: string;
  start_time: string | null;
  end_time: string | null;
  color_class: string;
  is_active: boolean;
}

export interface Staff {
  id: UUID;
  hospital_id: UUID;
  department_id: UUID;
  user_id: UUID | null;
  staff_number: string;
  full_name: string;
  rank: string | null;
  position: string | null;
  employment_type: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Roster {
  id: UUID;
  department_id: UUID;
  month: number;
  year: number;
  status: RosterStatus;
  created_by: UUID | null;
  approved_by: UUID | null;
  created_at: string;
  published_at: string | null;
}

export interface RosterEntry {
  id: UUID;
  roster_id: UUID;
  staff_id: UUID;
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
  staff_id: UUID;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveStatus;
  requested_at: string;
  reviewed_by: UUID | null;
  reviewed_at: string | null;
  notes: string | null;
}

export interface ShiftSwap {
  id: UUID;
  requester_id: UUID;
  replacement_id: UUID;
  requester_entry_id: UUID;
  replacement_entry_id: UUID;
  status: SwapStatus;
  requested_at: string;
  reviewed_by: UUID | null;
}

export interface UserRole {
  id: UUID;
  user_id: UUID;
  role: "admin" | "medical_director" | "department_head" | "doctor" | "nurse" | "hr_officer";
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
