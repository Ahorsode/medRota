export type UserRoleName =
  | "admin"
  | "hr_officer"
  | "department_head"
  | "doctor"
  | "nurse"
  | "medical_director"
  | "staff";

export function isHRRole(role: UserRoleName) {
  return role === "admin" || role === "hr_officer";
}

export function isStaffRole(role: UserRoleName) {
  return role === "doctor" || role === "nurse" || role === "staff";
}
