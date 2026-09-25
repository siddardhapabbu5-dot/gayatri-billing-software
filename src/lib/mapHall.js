/** Map Postgres / API hall rows into the React desk hall shape. */

function sid(prefix, id) {
  return id == null ? "" : `${prefix}${id}`;
}

/**
 * Desk sync used to emit flat halfDayRate/fullDayRate and omit seating.
 * Venues (and Reservations) read h.rates.halfDay / h.seating.join — that threw
 * and blanked /staff/venues after a live desk snapshot.
 */
export function mapHall(h, i = 0, baseHalls = []) {
  const code = String(h?.code || "").toUpperCase();
  const local =
    (baseHalls || []).find((x) => String(x.code || "").toUpperCase() === code) ||
    (baseHalls || []).find((x) => String(x.name || "").toLowerCase() === String(h?.name || "").toLowerCase()) ||
    null;
  const halfDay = Number(h?.halfDayRate ?? local?.rates?.halfDay ?? local?.halfDayRate ?? 0);
  const fullDay = Number(h?.fullDayRate ?? local?.rates?.fullDay ?? local?.fullDayRate ?? 0);
  const seating = Array.isArray(local?.seating)
    ? local.seating
    : Array.isArray(h?.seating)
      ? h.seating
      : [];

  return {
    ...(local || {}),
    id: sid("api-h-", h.id),
    serverId: h.id,
    code: h.code || local?.code || "",
    name: h.name || local?.name || "",
    capacity: h.capacity != null ? Number(h.capacity) : Number(local?.capacity || 0),
    rates: {
      halfDay,
      fullDay,
    },
    seating,
    kind: local?.kind || "Hall",
    dining: local?.dining ?? "",
    ac: local?.ac ?? false,
    kitchen: local?.kitchen ?? false,
    stage: local?.stage ?? false,
    parking: local?.parking ?? 0,
    setupHours: local?.setupHours ?? 0,
    teardownHours: local?.teardownHours ?? 0,
    bufferMinutes: local?.bufferMinutes ?? 0,
    active: h.active !== false,
    sort: i,
  };
}
