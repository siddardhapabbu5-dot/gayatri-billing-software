/**
 * Regression: API desk halls must map to the UI shape Venues/Reservations expect.
 * Previously mapHall only set flat halfDayRate/fullDayRate and omitted seating,
 * so Venues crashed on h.rates.halfDay / h.seating.join → blank /staff/venues.
 */
import assert from "node:assert/strict";
import { mapHall } from "../src/lib/mapHall.js";

const localImperial = {
  id: "hall-1",
  code: "IMPERIAL",
  name: "Imperial Ballroom",
  kind: "Indoor",
  capacity: 3000,
  dining: 1500,
  ac: true,
  kitchen: true,
  stage: true,
  parking: 300,
  seating: ["Banquet", "Theatre", "U-shape"],
  rates: { halfDay: 111, fullDay: 222 },
  setupHours: 4,
  teardownHours: 2,
  bufferMinutes: 60,
  active: true,
};

const apiHall = {
  id: 11,
  code: "IMPERIAL",
  name: "Imperial Ballroom",
  capacity: 3000,
  halfDayRate: 300000,
  fullDayRate: 450000,
  active: true,
};

const mapped = mapHall(apiHall, 0, [localImperial]);

assert.equal(mapped.serverId, 11);
assert.equal(mapped.code, "IMPERIAL");
assert.ok(mapped.rates && typeof mapped.rates === "object", "rates object required");
assert.equal(mapped.rates.halfDay, 300000, "API rates win over local");
assert.equal(mapped.rates.fullDay, 450000);
assert.ok(Array.isArray(mapped.seating), "seating must be an array");
assert.deepEqual(mapped.seating, ["Banquet", "Theatre", "U-shape"]);
assert.doesNotThrow(() => mapped.seating.join(", "));
assert.equal(mapped.kind, "Indoor");
assert.equal(mapped.setupHours, 4);
assert.equal(mapped.active, true);

// Reproduce the pre-fix crash shape: flat rates only, no seating
const brokenLegacy = {
  id: "api-h-11",
  serverId: 11,
  code: "IMPERIAL",
  name: "Imperial Ballroom",
  capacity: 3000,
  halfDayRate: 300000,
  fullDayRate: 450000,
  active: true,
};
assert.throws(() => {
  void brokenLegacy.rates.halfDay;
}, /Cannot read properties of undefined/);
assert.throws(() => {
  brokenLegacy.seating.join(", ");
}, TypeError);

// No local match — still must not crash Venues field access
const bare = mapHall(
  { id: 99, code: "X", name: "X Hall", capacity: 10, halfDayRate: 1, fullDayRate: 2, active: true },
  0,
  []
);
assert.deepEqual(bare.rates, { halfDay: 1, fullDay: 2 });
assert.deepEqual(bare.seating, []);
assert.doesNotThrow(() => bare.seating.join(", "));
assert.doesNotThrow(() => {
  void bare.rates.halfDay;
});

console.log("ok: mapHall preserves Venues-compatible hall shape");
