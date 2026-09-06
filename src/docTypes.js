export const HOTEL_DOCS = [
  { id: "hotel-id", label: "Guest photo ID", hint: "Aadhaar, Passport, Driving licence or Voter ID — mandatory at check-in in India", required: true, scope: "hotel" },
  { id: "hotel-photo", label: "Guest photograph", hint: "Front-desk photo or passport-size copy", required: true, scope: "hotel" },
  { id: "hotel-address", label: "Address proof", hint: "If the ID does not show current address", required: false, scope: "hotel" },
  { id: "hotel-passport", label: "Passport (foreign guest)", hint: "Bio page of passport", required: false, scope: "hotel", foreign: true },
  { id: "hotel-visa", label: "Visa / OCI", hint: "Required for foreign nationals", required: false, scope: "hotel", foreign: true },
  { id: "hotel-formc", label: "Form C (FRRO)", hint: "C-Form acknowledgement for foreign stay", required: false, scope: "hotel", foreign: true },
  { id: "hotel-gst", label: "Company GST certificate", hint: "Corporate / billed-to-company stays", required: false, scope: "hotel" },
  { id: "hotel-auth", label: "Company authorisation letter", hint: "Letter on letterhead for staff stay", required: false, scope: "hotel" },
];

export const HALL_DOCS = [
  { id: "hall-id", label: "Booking party photo ID", hint: "Aadhaar, PAN or Passport of the person signing the booking", required: true, scope: "hall" },
  { id: "hall-address", label: "Address proof", hint: "Utility bill, Aadhaar or passport address page", required: true, scope: "hall" },
  { id: "hall-contract", label: "Signed hall contract", hint: "Signed quotation / terms / e-contract", required: true, scope: "hall" },
  { id: "hall-advance", label: "Advance payment proof", hint: "UPI screenshot, bank slip or cheque copy", required: true, scope: "hall" },
  { id: "hall-gstin", label: "GSTIN / company PAN", hint: "When the bill is in a company name", required: false, scope: "hall" },
  { id: "hall-invite", label: "Event invitation / agenda", hint: "Event name and date as printed", required: false, scope: "hall" },
  { id: "hall-po", label: "Purchase order / company letter", hint: "If the organiser is a company", required: false, scope: "hall" },
  { id: "hall-noc", label: "Police / loudspeaker NOC", hint: "Late sound or outdoor programme", required: false, scope: "hall" },
  { id: "hall-deposit", label: "Security deposit cheque", hint: "Refundable deposit instrument", required: false, scope: "hall" },
];

export const ALL_DOCS = [...HOTEL_DOCS, ...HALL_DOCS];

export function specById(id) {
  return ALL_DOCS.find((d) => d.id === id);
}

export function scopesForBooking(state, bookingId) {
  if (!bookingId) return { hall: true, room: true };
  const hall = (state.hallReservations || []).some((r) => r.bookingId === bookingId && r.status !== "Cancelled");
  const room = (state.roomReservations || []).some((r) => r.bookingId === bookingId && r.status !== "Cancelled");
  const booking = (state.bookings || []).find((b) => b.id === bookingId);
  if (booking?.type === "Room only") return { hall: false, room: true };
  return { hall, room: room || booking?.type === "Room only" };
}

export function requiredFromDraft(draft, nationality = "India") {
  const hall = (draft?.halls || []).length > 0;
  const room = (draft?.rooms || []).length > 0 || draft?.type === "Room only";
  let list = [];
  if (room) list = list.concat(HOTEL_DOCS);
  if (hall) list = list.concat(HALL_DOCS);
  if (!hall && !room) list = ALL_DOCS.filter((d) => d.required);
  if (nationality === "India") list = list.filter((d) => !d.foreign);
  const seen = new Set();
  return list.filter((d) => (seen.has(d.id) ? false : seen.add(d.id)));
}

export function requiredList(state, bookingId) {
  const { hall, room } = scopesForBooking(state, bookingId);
  const guest = state.guests.find((g) => g.id === state.bookings.find((b) => b.id === bookingId)?.guestId);
  const foreign = guest && guest.nationality && guest.nationality !== "India";
  let list = [];
  if (room) list = list.concat(HOTEL_DOCS);
  if (hall) list = list.concat(HALL_DOCS);
  if (!hall && !room) list = ALL_DOCS.filter((d) => d.required);
  if (!foreign) list = list.filter((d) => !d.foreign);
  const seen = new Set();
  return list.filter((d) => (seen.has(d.id) ? false : seen.add(d.id)));
}

export function docsForBooking(state, bookingId) {
  return (state.documents || []).filter((d) => d.bookingId === bookingId);
}

export function coverage(state, bookingId) {
  const need = requiredList(state, bookingId).filter((d) => d.required);
  const have = new Set(docsForBooking(state, bookingId).map((d) => d.typeId));
  const missing = need.filter((d) => !have.has(d.id));
  return { need, have, missing, ok: missing.length === 0, uploaded: docsForBooking(state, bookingId).length };
}

export function formatBytes(n) {
  if (!n) return "0 KB";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
