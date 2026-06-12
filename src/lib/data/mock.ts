import type { Department, Hospital, LeaveRequest, Roster, RosterEntry, ShiftConfiguration, ShiftSwap, Staff } from "@/lib/types";
import { getIsoDate, getMonthDays } from "@/lib/utils/dates";
import { shiftColorClasses } from "@/lib/utils/shifts";

const now = "2026-06-12T00:00:00.000Z";
const hospitalId = "11111111-1111-4111-8111-111111111111";

export const hospital: Hospital = {
  id: hospitalId,
  name: "SDA Hospital, Koforidua",
  location: "Koforidua, Eastern Region, Ghana",
  created_at: now,
};

export const departments: Department[] = [
  ["health-records", "Health Records / Information Department", "Patient records and information management"],
  ["opd", "OPD", "Outpatient Department duty coverage"],
  ["prescribers", "Prescribers", "Doctors and prescriber roster"],
  ["security", "Security", "Hospital gate and ward patrol coverage"],
  ["icu", "ICU", "Intensive care nursing"],
  ["maternity", "Maternity", "Maternity and neonatal coverage"],
  ["emergency", "Emergency", "Emergency unit"],
  ["pharmacy", "Pharmacy", "Dispensing and inventory operations"],
  ["lab", "Lab", "Diagnostics and laboratory services"],
].map(([id, name, description]) => ({
  id,
  hospital_id: hospitalId,
  name,
  description,
  is_active: true,
  created_at: now,
}));

export const shiftConfigurations: ShiftConfiguration[] = departments.flatMap((department) => {
  if (department.id === "security") {
    return [
      shiftConfig(department.id, "M", "Day Security", "07:00", "18:30"),
      shiftConfig(department.id, "N", "Night Security", "18:30", "07:00"),
      shiftConfig(department.id, "%", "Off Day", null, null),
      shiftConfig(department.id, "H", "Holiday", null, null),
    ];
  }

  return [
    shiftConfig(department.id, "M", "Morning", "07:30", "14:00"),
    shiftConfig(department.id, "A", "Afternoon", "14:00", "20:00"),
    shiftConfig(department.id, "N", "Night", "20:00", "08:00"),
    shiftConfig(department.id, "O", "Off Day", null, null),
    shiftConfig(department.id, "H", "Holiday", null, null),
  ];
});

export const staff: Staff[] = [
  staffMember("s001", "opd", "R. Opoku", "SNO", "Senior Nursing Officer"),
  staffMember("s002", "opd", "A. Amo-Nuadu", "NO", "Nursing Officer"),
  staffMember("s003", "opd", "R. Agyekey", "NO", "Nursing Officer"),
  staffMember("s004", "opd", "Sandra S.", "SEN", "Senior Enrolled Nurse"),
  staffMember("s005", "opd", "E. Asante", "SN", "Staff Nurse"),
  staffMember("s006", "opd", "M. Boateng", "EN", "Enrolled Nurse"),
  staffMember("s007", "prescribers", "Dr. K. Mensah", "MO", "Medical Officer"),
  staffMember("s008", "prescribers", "Dr. Akua Frimpong", "Specialist", "Specialist"),
  staffMember("s009", "prescribers", "P. Yeboah", "PA", "Physician Assistant"),
  staffMember("s010", "security", "Isaac Baah", "SO", "Security Officer"),
  staffMember("s011", "security", "Kojo Owusu", "SO", "Security Officer"),
  staffMember("s012", "security", "Mary Adjei", "SSO", "Senior Security Officer"),
  staffMember("s013", "health-records", "Hannah Ofori", "HEO", "Health Extension Officer"),
  staffMember("s014", "health-records", "Caleb Nti", "Records", "Records Officer"),
  staffMember("s015", "maternity", "Gifty Nyarko", "RN", "Registered Nurse"),
  staffMember("s016", "emergency", "Priscilla Darko", "SNO", "Senior Nursing Officer"),
];

export const rosters: Roster[] = departments.slice(0, 6).map((department, index) => ({
  id: `roster-${department.id}-2026-06`,
  department_id: department.id,
  month: 6,
  year: 2026,
  status: index === 0 ? "published" : index === 1 ? "draft" : index === 2 ? "submitted" : "approved",
  created_by: null,
  approved_by: null,
  created_at: now,
  published_at: index === 0 ? "2026-06-01T08:00:00.000Z" : null,
}));

export const rosterEntries: RosterEntry[] = [
  ...generateDepartmentEntries("opd", ["s001", "s002", "s003", "s004", "s005", "s006"], ["M", "M", "A", "N", "O", "O"], 6, 2026),
  ...generateDepartmentEntries("prescribers", ["s007", "s008", "s009"], ["M", "A", "O", "N"], 6, 2026),
  ...generateDepartmentEntries("security", ["s010", "s011", "s012"], ["M", "N", "%"], 6, 2026),
  ...generateDepartmentEntries("health-records", ["s013", "s014"], ["M", "A", "O"], 6, 2026),
];

export const leaveRequests: LeaveRequest[] = [
  {
    id: "leave-s004-annual",
    staff_id: "s004",
    leave_type: "Annual",
    start_date: "2026-06-07",
    end_date: "2026-06-13",
    reason: "Approved annual leave block",
    status: "approved",
    requested_at: "2026-05-24T09:00:00.000Z",
    reviewed_by: null,
    reviewed_at: "2026-05-26T10:30:00.000Z",
    notes: "Roster span should render as one merged block.",
  },
  {
    id: "leave-s008-study",
    staff_id: "s008",
    leave_type: "Study",
    start_date: "2026-06-16",
    end_date: "2026-06-20",
    reason: "Clinical update course",
    status: "approved",
    requested_at: "2026-06-01T11:00:00.000Z",
    reviewed_by: null,
    reviewed_at: "2026-06-03T12:00:00.000Z",
    notes: null,
  },
  {
    id: "leave-s015-sick",
    staff_id: "s015",
    leave_type: "Sick",
    start_date: "2026-06-18",
    end_date: "2026-06-19",
    reason: "Medical review",
    status: "pending",
    requested_at: "2026-06-10T08:30:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    notes: null,
  },
];

export const shiftSwaps: ShiftSwap[] = [
  {
    id: "swap-001",
    requester_id: "s003",
    replacement_id: "s005",
    requester_entry_id: "entry-opd-s003-2026-06-11",
    replacement_entry_id: "entry-opd-s005-2026-06-11",
    status: "pending",
    requested_at: "2026-06-09T16:00:00.000Z",
    reviewed_by: null,
  },
];

function shiftConfig(
  departmentId: string,
  code: ShiftConfiguration["shift_code"],
  name: string,
  start: string | null,
  end: string | null,
): ShiftConfiguration {
  return {
    id: `shift-${departmentId}-${code}`,
    department_id: departmentId,
    shift_code: code,
    shift_name: name,
    start_time: start,
    end_time: end,
    color_class: shiftColorClasses[code],
    is_active: true,
  };
}

function staffMember(id: string, departmentId: string, fullName: string, rank: string, position: string): Staff {
  return {
    id,
    hospital_id: hospitalId,
    department_id: departmentId,
    user_id: null,
    staff_number: id.toUpperCase(),
    full_name: fullName,
    rank,
    position,
    employment_type: "Full-time",
    phone: `+233 24 000 ${id.slice(1).padStart(4, "0")}`,
    email: `${fullName.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\./, "").replace(/\.$/, "")}@sdahospital.example`,
    is_active: true,
    created_at: now,
  };
}

function generateDepartmentEntries(departmentId: string, staffIds: string[], pattern: string[], month: number, year: number): RosterEntry[] {
  const roster = rosters.find((item) => item.department_id === departmentId);
  if (!roster) return [];

  return staffIds.flatMap((staffId, staffIndex) =>
    getMonthDays(year, month).map((day, dayIndex) => {
      const annualLeave = staffId === "s004" && day.dayNumber >= 7 && day.dayNumber <= 13;
      const studyLeave = staffId === "s008" && day.dayNumber >= 16 && day.dayNumber <= 20;
      const code = annualLeave || studyLeave ? "LEAVE" : pattern[(dayIndex + staffIndex) % pattern.length];

      return {
        id: `entry-${departmentId}-${staffId}-${day.iso}`,
        roster_id: roster.id,
        staff_id: staffId,
        shift_date: getIsoDate(year, month, day.dayNumber),
        shift_code: code as RosterEntry["shift_code"],
        shift_config_id: code === "LEAVE" ? null : `shift-${departmentId}-${code}`,
        notes: annualLeave ? "Part Leave" : studyLeave ? "Study Leave" : null,
        is_leave: annualLeave || studyLeave,
        leave_type: annualLeave ? "Annual" : studyLeave ? "Study" : null,
        created_at: now,
        updated_at: now,
      };
    }),
  );
}
