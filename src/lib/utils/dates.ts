import { eachDayOfInterval, endOfMonth, format, getDay, isSameDay, startOfMonth } from "date-fns";

export const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function getMonthDays(year: number, month: number) {
  const start = startOfMonth(new Date(year, month - 1, 1));
  const end = endOfMonth(start);

  return eachDayOfInterval({ start, end }).map((date) => ({
    date,
    iso: format(date, "yyyy-MM-dd"),
    dayNumber: Number(format(date, "d")),
    dayName: dayInitial(getDay(date)),
    isWeekend: [0, 6].includes(getDay(date)),
    isHoliday: ghanaPublicHolidays(year).some((holiday) => isSameDay(holiday.date, date)),
  }));
}

function dayInitial(day: number) {
  return ["S", "M", "T", "W", "TH", "F", "S"][day];
}

export function daysInMonth(year: number, month: number) {
  return getMonthDays(year, month).length;
}

export function ghanaPublicHolidays(year: number) {
  return [
    { date: new Date(year, 0, 1), name: "New Year's Day" },
    { date: new Date(year, 0, 7), name: "Constitution Day" },
    { date: new Date(year, 2, 6), name: "Independence Day" },
    { date: new Date(year, 4, 1), name: "May Day" },
    { date: new Date(year, 7, 4), name: "Founders' Day" },
    { date: new Date(year, 8, 21), name: "Kwame Nkrumah Memorial Day" },
    { date: new Date(year, 11, 25), name: "Christmas Day" },
    { date: new Date(year, 11, 26), name: "Boxing Day" },
  ];
}

export function formatDateLabel(value: string) {
  return format(new Date(`${value}T00:00:00`), "EEE, MMM d, yyyy");
}

export function getIsoDate(year: number, month: number, day: number) {
  return format(new Date(year, month - 1, day), "yyyy-MM-dd");
}
