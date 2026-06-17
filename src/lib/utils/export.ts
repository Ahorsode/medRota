import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { Department, Roster, RosterEntry, Staff } from "@/lib/types";
import { getMonthDays, monthNames } from "@/lib/utils/dates";
import { buildEntryMap, getEntryKey } from "@/lib/utils/shifts";

const hospitalName = "SDA Hospital";

interface ExportPayload {
  roster: Roster;
  department: Department;
  staff: Staff[];
  entries: RosterEntry[];
}

type AutoTableDocument = jsPDF & {
  lastAutoTable?: false | { finalY?: number };
};

export function exportRosterToPdf({ roster, department, staff, entries }: ExportPayload) {
  const days = getMonthDays(roster.year, roster.month);
  const entryMap = buildEntryMap(entries);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const activeStaff = staff.filter((person) => person.department_id === department.id);

  doc.setFontSize(16);
  doc.text(hospitalName, 40, 36);
  doc.setFontSize(11);
  doc.text(`${department.name.toUpperCase()} DUTY ROSTER · ${monthNames[roster.month - 1]} ${roster.year}`, 40, 56);

  autoTable(doc, {
    startY: 76,
    head: [
      ["Name", "Rank", ...days.map((day) => String(day.dayNumber))],
      ["", "", ...days.map((day) => day.dayName)],
    ],
    body: activeStaff.map((person) => [
      person.full_name,
      person.rank ?? "",
      ...days.map((day) => entryMap.get(getEntryKey(person.id, day.iso))?.shift_code ?? ""),
    ]),
    styles: { fontSize: 6, cellPadding: 2, halign: "center" },
    headStyles: { fillColor: [26, 43, 74], textColor: [255, 255, 255] },
    columnStyles: {
      0: { halign: "left", cellWidth: 92 },
      1: { cellWidth: 34 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index > 1) {
        const value = String(data.cell.raw);
        if (value === "N") data.cell.styles.fillColor = [224, 231, 255];
        if (value === "A") data.cell.styles.fillColor = [254, 243, 199];
        if (value === "M") data.cell.styles.fillColor = [219, 234, 254];
        if (value === "LEAVE") data.cell.styles.fillColor = [243, 232, 255];
      }
    },
  });

  const autoTableDoc = doc as AutoTableDocument;
  const tableEndY = autoTableDoc.lastAutoTable && typeof autoTableDoc.lastAutoTable === "object" ? autoTableDoc.lastAutoTable.finalY ?? 76 : 76;
  let sigY = tableEndY + 18;
  if (sigY + 42 > doc.internal.pageSize.height - 36) {
    doc.addPage();
    sigY = 40;
  }

  const signatures = roster.signatures ?? [];
  const hodSig = signatures.find((signature) => signature.role === "hod");
  const directorSig = signatures.find((signature) => signature.role === "director");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("AUTHORISATION", 40, sigY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  doc.rect(40, sigY + 8, 230, 34);
  doc.text("Department Head:", 48, sigY + 20);
  doc.setFont("helvetica", "bold");
  doc.text(hodSig?.name ?? "___________________", 48, sigY + 31);
  doc.setFont("helvetica", "normal");
  doc.text(hodSig?.signed_at ? new Date(hodSig.signed_at).toLocaleDateString() : "Date: ___________", 160, sigY + 31);

  doc.rect(290, sigY + 8, 230, 34);
  doc.text("Medical Director:", 298, sigY + 20);
  doc.setFont("helvetica", "bold");
  doc.text(directorSig?.name ?? "___________________", 298, sigY + 31);
  doc.setFont("helvetica", "normal");
  doc.text(directorSig?.signed_at ? new Date(directorSig.signed_at).toLocaleDateString() : "Date: ___________", 410, sigY + 31);

  const footerY = doc.internal.pageSize.height - 36;
  doc.setFontSize(8);
  doc.text("M=Morning, A=Afternoon, N=Night, O/%=Off Day, H=Holiday, LEAVE=Approved leave block", 40, footerY);
  doc.save(`${department.name}-${format(new Date(roster.year, roster.month - 1), "yyyy-MM")}-roster.pdf`);
}

export function exportRosterToExcel({ roster, department, staff, entries }: ExportPayload) {
  const days = getMonthDays(roster.year, roster.month);
  const entryMap = buildEntryMap(entries);
  const activeStaff = staff.filter((person) => person.department_id === department.id);
  const rows = [
    [hospitalName],
    [`${department.name.toUpperCase()} DUTY ROSTER`, `${monthNames[roster.month - 1]} ${roster.year}`],
    ["Name", "Rank", ...days.map((day) => day.dayNumber)],
    ["", "", ...days.map((day) => day.dayName)],
    ...activeStaff.map((person) => [
      person.full_name,
      person.rank ?? "",
      ...days.map((day) => entryMap.get(getEntryKey(person.id, day.iso))?.shift_code ?? ""),
    ]),
    [],
    ["Legend", "M=Morning", "A=Afternoon", "N=Night", "O/%=Off", "H=Holiday", "LEAVE=Approved Leave"],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Duty Roster");
  XLSX.writeFile(book, `${department.name}-${format(new Date(roster.year, roster.month - 1), "yyyy-MM")}-roster.xlsx`);
}
