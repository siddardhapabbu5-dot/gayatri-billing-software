/**
 * Smoke: open each staff sidebar path after auth inject; fail if the main shell blanks.
 * Run: npx playwright test is not configured — invoke with `node scripts/staff-routes-smoke.mjs`
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.STAFF_SMOKE_BASE || "http://127.0.0.1:4177";

const PATHS = [
  "/staff",
  "/staff/calendar",
  "/staff/venues",
  "/staff/rooms",
  "/staff/reservations",
  "/staff/guests",
  "/staff/documents",
  "/staff/vendors",
  "/staff/billing",
  "/staff/expenses",
  "/staff/reports",
  "/staff/assistant",
  "/staff/settings",
  "/staff/master",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(String(err)));

await page.goto(`${BASE}/staff`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  localStorage.setItem("gayatri-vhms-jwt", "test-token");
  localStorage.setItem(
    "gayatri-vhms-auth-user",
    JSON.stringify({ id: "1", name: "Owner", email: "owner@test.com", role: "admin", permissions: ["*"] })
  );
  // Simulate post-sync API halls (flat rates) — the production blank-screen shape.
  const KEY = "gayatri-vhms-v3";
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const s = JSON.parse(raw);
    s.halls = [
      {
        id: "api-h-1",
        serverId: 1,
        code: "IMPERIAL",
        name: "Imperial Ballroom",
        capacity: 3000,
        halfDayRate: 300000,
        fullDayRate: 450000,
        active: true,
      },
    ];
    localStorage.setItem(KEY, JSON.stringify(s));
  }
});

const results = [];
for (const path of PATHS) {
  pageErrors.length = 0;
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const text = (await page.locator("body").innerText()).trim();
  const blank = text.length < 40;
  const href = page.url();
  results.push({ path, href, blank, errors: [...pageErrors], len: text.length });
  assert.equal(blank, false, `blank screen at ${path}`);
  assert.ok(!pageErrors.length, `pageerror at ${path}: ${pageErrors.join(" | ")}`);
  assert.ok(href.includes(path.replace(/\/$/, "")), `URL drifted from ${path} → ${href}`);
}

// Focused venues assertion
const venues = results.find((r) => r.path === "/staff/venues");
assert.ok(venues && !venues.blank);
const venuesText = await page.goto(`${BASE}/staff/venues`, { waitUntil: "networkidle" }).then(async () => {
  await page.waitForTimeout(300);
  return page.locator("body").innerText();
});
assert.match(venuesText, /Venues/i);
assert.match(venuesText, /Imperial/i);

console.log("ok: staff sidebar routes render", results.map((r) => r.path).join(", "));
await browser.close();
