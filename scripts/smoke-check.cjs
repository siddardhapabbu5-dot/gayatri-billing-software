const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push("console: " + msg.text());
  });
  const results = [];
  async function check(label, fn) {
    try {
      await fn();
      results.push("PASS " + label);
    } catch (e) {
      results.push("FAIL " + label + " :: " + e.message);
    }
  }

  await page.goto("http://127.0.0.1:5177/#home", { waitUntil: "networkidle", timeout: 60000 });

  await check("home loads", async () => {
    await page.waitForSelector(".lux-root, .site-header, body", { timeout: 15000 });
    const t = await page.title();
    if (!t) throw new Error("no title");
  });

  await check("nav gallery", async () => {
    await page.goto("http://127.0.0.1:5177/#gallery", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const n = await page.locator(".gallery-item, .gallery-mosaic button").count();
    if (n < 4) throw new Error("gallery items=" + n);
  });

  await check("nav booking month calendar", async () => {
    await page.goto("http://127.0.0.1:5177/#booking", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const month = await page.locator(".avail-month, .avail-view-toggle").count();
    if (!month) throw new Error("no month calendar UI");
  });

  await check("enter staff desk", async () => {
    await page.goto("http://127.0.0.1:5177/#staff", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const btn = page.getByRole("button", { name: /Enter staff desk/i });
    if (await btn.count()) await btn.click();
    else throw new Error("Enter staff desk button missing");
    await page.waitForTimeout(1200);
    const shell = await page.locator(".shell, .nav, aside").count();
    if (!shell) throw new Error("staff shell missing");
  });

  const staffPages = [
    ["Dashboard", /Dashboard/i],
    ["Calendar", /Calendar/i],
    ["Reservations", /Reservations/i],
    ["Payment", /Payment|Invoice/i],
    ["Reports", /Reports/i],
    ["Settings", /Settings/i],
  ];

  for (const [name, re] of staffPages) {
    await check("staff " + name, async () => {
      const navBtn = page.locator(".nav button, aside button").filter({ hasText: re }).first();
      if (!(await navBtn.count())) throw new Error("nav missing " + name);
      await navBtn.click();
      await page.waitForTimeout(800);
      const body = await page.locator(".shell").innerText();
      if (!body || body.length < 20) throw new Error("empty page");
    });
  }

  await check("billing find party search", async () => {
    const navBtn = page.locator(".nav button, aside button").filter({ hasText: /Payment|Invoice/i }).first();
    await navBtn.click();
    await page.waitForTimeout(700);
    const search = page.getByPlaceholder(/BK-|name|phone|UPI/i);
    if (!(await search.count())) throw new Error("find party search missing");
  });

  await check("reservations final payment section", async () => {
    const navBtn = page.locator(".nav button, aside button").filter({ hasText: /Reservations/i }).first();
    await navBtn.click();
    await page.waitForTimeout(600);
    const newBtn = page.getByRole("button", { name: /New reservation/i });
    if (await newBtn.count()) await newBtn.click();
    await page.waitForTimeout(1000);
    const final = await page.getByText(/Final payment/i).count();
    if (!final) throw new Error("final payment section missing");
  });

  console.log(results.join("\n"));
  if (errors.length) console.log("JS_ERRORS\n" + [...new Set(errors)].slice(0, 20).join("\n"));
  else console.log("JS_ERRORS none");
  await browser.close();
  process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
