/** Expense & charge catalogs for Gayatri VHMS (localStorage desk). */

export const EXPENSE_DEPARTMENTS = ["Hotel", "Function Hall", "Common", "Admin"];

export const EXPENSE_CATEGORIES = [
  { id: "diesel", label: "Diesel" },
  { id: "tea", label: "Tea / coffee / refreshments" },
  { id: "food", label: "Food / material purchases" },
  { id: "cleaning", label: "Cleaning materials" },
  { id: "electricity", label: "Electricity" },
  { id: "water", label: "Water" },
  { id: "maintenance", label: "Maintenance" },
  { id: "salaries", label: "Salaries / wages" },
  { id: "transport", label: "Transportation" },
  { id: "purchase", label: "Purchase / material" },
  { id: "other", label: "Other expenses" },
];

export const CHARGE_CATEGORIES = [
  { id: "food", label: "Food" },
  { id: "tea", label: "Tea / coffee" },
  { id: "laundry", label: "Laundry" },
  { id: "extraBed", label: "Extra bed" },
  { id: "decoration", label: "Decoration" },
  { id: "other", label: "Other service" },
  { id: "hall", label: "Hall charge (extra)" },
  { id: "room", label: "Room charge (extra)" },
];

export const PAY_MODES = ["Cash", "UPI", "Card", "Bank transfer"];

export function expenseLabel(id) {
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.label || id || "Other";
}

export function chargeLabel(id) {
  return CHARGE_CATEGORIES.find((c) => c.id === id)?.label || id || "Charge";
}

export function paymentStatus(totals, booking) {
  // Whole-booking cancel only — room cancel or credit refund must not look like "Cancelled".
  if (booking?.status === "Cancelled") return "Cancelled";
  const paid = Number(totals?.paid || 0);
  const balance = Number(totals?.balance || 0);
  if (totals?.closed) return "Cancelled";
  if (Number(totals?.total || 0) <= 0 && paid <= 0) return "—";
  if (balance < 0) return "Credit";
  if (balance === 0 && paid > 0) return "Paid";
  if (paid > 0) return "Partially Paid";
  return "Pending";
}
