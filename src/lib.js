export const KEY = "gayatri-vhms-v3";

export function pad(n) {
  return String(n).padStart(2, "0");
}

export function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfMonthISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

export function downloadCsv(filename, rows) {
  const body = rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell == null) return "";
          const s = String(cell);
          if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(",")
    )
    .join("\r\n");
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return todayISO(d);
}

export function formatDate(iso) {
  if (!iso) return "—";
  return parseISO(String(iso).slice(0, 10)).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateDMY(iso) {
  const raw = String(iso || "").slice(0, 10);
  if (!raw || !raw.includes("-")) return "—";
  const [y, m, d] = raw.split("-");
  return `${d}-${m}-${y}`;
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatDate(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDateTime(date, time) {
  return `${date}T${time}:00`;
}

export function addHours(isoDateTime, hours) {
  const d = new Date(isoDateTime);
  d.setHours(d.getHours() + hours);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function money(amount, currency = "INR", locale = "en-IN") {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  } catch {
    return `${currency} ${Number(amount) || 0}`;
  }
}

export function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const start = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}

export function nightsBetween(a, b) {
  return Math.max(1, daysBetween(a, b));
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function seqNo(list, field, prefix, year = new Date().getFullYear()) {
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const max = list.reduce((m, item) => {
    const hit = String(item[field] || "").match(re);
    return hit ? Math.max(m, Number(hit[1])) : m;
  }, 0);
  return `${prefix}-${year}-${String(max + 1).padStart(5, "0")}`;
}

export function weekday(iso) {
  return parseISO(iso).getDay();
}

export function isWeekend(iso) {
  const d = weekday(iso);
  return d === 0 || d === 6;
}

export function inRange(iso, from, to) {
  return iso >= from && iso <= to;
}

export function startOfWeek(iso) {
  const d = parseISO(iso);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return todayISO(d);
}

export function weekDays(iso) {
  const start = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function hoursList() {
  return Array.from({ length: 24 }, (_, h) => `${pad(h)}:00`);
}

export function statusTone(status) {
  const map = {
    Available: "ok",
    Inspected: "ok",
    Confirmed: "ok",
    Paid: "ok",
    Occupied: "warn",
    Reserved: "warn",
    Advance: "warn",
    Enquiry: "warn",
    Quoted: "warn",
    Dirty: "due",
    Cleaning: "due",
    Maintenance: "due",
    "Out of order": "due",
    Overdue: "due",
    Cancelled: "muted",
    Refunded: "muted",
    Pending: "warn",
    Done: "ok",
    "In progress": "warn",
  };
  return map[status] || "muted";
}

export function indiaDigits(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10) return `91${d}`;
  if (d.startsWith("0") && d.length === 11) return `91${d.slice(1)}`;
  if (d.startsWith("91")) return d;
  return d;
}

export function waMe(phone, text) {
  const n = indiaDigits(phone);
  if (!n) return "";
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export function smsHref(phone, text) {
  const n = indiaDigits(phone);
  if (!n) return "";
  return `sms:+${n}?body=${encodeURIComponent(text)}`;
}

export function telHref(phone) {
  const n = indiaDigits(phone);
  return n ? `tel:+${n}` : "";
}

export function enquiryAlertText(enq) {
  return [
    "Gayatri Function Hall — new booking",
    enq.number ? `Ref: ${enq.number}` : "",
    `Name: ${enq.name}`,
    `Phone: ${enq.phone}`,
    enq.email ? `Email: ${enq.email}` : "",
    `Event: ${enq.type}`,
    `Date: ${enq.date}`,
    `Hall: ${enq.hall || "Any available"}`,
    `Guests: ${enq.guests}`,
    enq.message ? `Notes: ${enq.message}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
