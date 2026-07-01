import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: ".env.local" });
loadEnv();

const HOSPITAL_ID = "11111111-1111-4111-8111-111111111111";

type SeedUser = {
  email: string;
  full_name: string;
  staff_number: string;
  role: "hr_officer" | "department_head" | "staff";
  department_name: string;
  rank: string;
  position: string;
  phone: string;
};

const TEAM: SeedUser[] = [
  {
    email: "spaatlov@gmail.com",
    full_name: "Lov Spaat",
    staff_number: "HR001",
    role: "hr_officer",
    department_name: "Nursing Administration",
    rank: "Admin Officer",
    position: "HR Officer",
    phone: "+233241112001",
  },
  {
    email: "ahorsodedelali@gmail.com",
    full_name: "Delali Ahorsode",
    staff_number: "HR002",
    role: "hr_officer",
    department_name: "Nursing Administration",
    rank: "Admin Officer",
    position: "HR Officer",
    phone: "+233241112002",
  },
  {
    email: "lazatrain@gmail.com",
    full_name: "Lazarus A. Train",
    staff_number: "HOD001",
    role: "department_head",
    department_name: "OPD",
    rank: "SNO",
    position: "Head of OPD",
    phone: "+233241112003",
  },
  {
    email: "benjamindelali23@gmail.com",
    full_name: "Benjamin Delali",
    staff_number: "HOD002",
    role: "department_head",
    department_name: "Emergency",
    rank: "SNO",
    position: "Head of Emergency",
    phone: "+233241112004",
  },
  {
    email: "acheampongvida286@gmail.com",
    full_name: "Vida Acheampong",
    staff_number: "STF001",
    role: "staff",
    department_name: "OPD",
    rank: "NO",
    position: "Nursing Officer",
    phone: "+233241112005",
  },
  {
    email: "ahorsode@gmail.com",
    full_name: "Delali Ahorsode",
    staff_number: "STF002",
    role: "staff",
    department_name: "Maternity",
    rank: "NO",
    position: "Nursing Officer",
    phone: "+233241112006",
  },
];

function createPrisma() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or DIRECT_URL is required");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function createAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || serviceKey.includes("your-service-role-key")) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function main() {
  const prisma = createPrisma();
  const admin = createAdmin();

  console.log("Seeding MedRota team users...\n");

  for (const person of TEAM) {
    const department = await prisma.department.findFirst({
      where: { name: person.department_name },
      select: { id: true, hospital_id: true },
    });

    const hrFallback = await prisma.department.findFirst({
      where: { name: "Health Records / Information Department" },
      select: { id: true, hospital_id: true },
    });

    const resolvedDepartment =
      department ??
      (person.role === "hr_officer" ? hrFallback : null);

    if (!resolvedDepartment) {
      throw new Error(`Department not found: ${person.department_name}`);
    }

    const existingStaff = await prisma.staff.findFirst({
      where: { OR: [{ email: person.email }, { staff_number: person.staff_number }] },
    });

    let userId = existingStaff?.user_id ?? null;

    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: person.email,
        password: person.staff_number,
        email_confirm: true,
        user_metadata: { full_name: person.full_name, provisioned_by: "seed_team_users" },
      });

      if (error || !data.user) {
        throw new Error(`Auth create failed for ${person.email}: ${error?.message ?? "unknown"}`);
      }

      userId = data.user.id;
      console.log(`Created auth user: ${person.email}`);
    } else {
      await admin.auth.admin.updateUserById(userId, {
        password: person.staff_number,
        email_confirm: true,
      });
      console.log(`Updated auth user: ${person.email}`);
    }

    const staff = await prisma.staff.upsert({
      where: { staff_number: person.staff_number },
      create: {
        hospital_id: resolvedDepartment.hospital_id ?? HOSPITAL_ID,
        department_id: resolvedDepartment.id,
        user_id: userId,
        staff_number: person.staff_number,
        full_name: person.full_name,
        rank: person.rank,
        position: person.position,
        employment_type: "Full-time",
        phone: person.phone,
        email: person.email,
        must_change_password: true,
        allow_staff_id_login: true,
        has_logged_in: false,
        login_identifier_type: "email",
        invited_at: new Date(),
      },
      update: {
        department_id: resolvedDepartment.id,
        user_id: userId,
        full_name: person.full_name,
        rank: person.rank,
        position: person.position,
        phone: person.phone,
        email: person.email,
        must_change_password: true,
        allow_staff_id_login: true,
        login_identifier_type: "email",
      },
    });

    await prisma.userRole.upsert({
      where: {
        user_id_role_department_id: {
          user_id: userId,
          role: person.role,
          department_id: resolvedDepartment.id,
        },
      },
      create: {
        user_id: userId,
        role: person.role,
        department_id: resolvedDepartment.id,
      },
      update: {},
    });

    console.log(
      `  ${person.full_name} | ${person.role} | ${person.department_name} | login: ${person.email} | temp password: ${person.staff_number}`,
    );
    console.log(`  staff id: ${staff.id}\n`);
  }

  await prisma.$disconnect();
  console.log("Done. All users should sign in and set a new password on first login.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
