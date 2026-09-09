import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "tablet-preview");
mkdirSync(outDir, { recursive: true });

const BASE = process.env.PREVIEW_URL || "https://gayatri-billing-software-production.up.railway.app";

const VIEWPORTS = [
  { id: "ipad-portrait", label: "iPad portrait", width: 768, height: 1024 },
  { id: "ipad-landscape", label: "iPad landscape", width: 1024, height: 768 },
];

const PAGES = [
  { id: "home", hash: "#home", title: "Home" },
  { id: "about", hash: "#about", title: "The Hall" },
  { id: "venues", hash: "#venues", title: "Venues" },
  { id: "stay", hash: "#stay", title: "The Royal Family Retreat" },
  { id: "rooms", hash: "#rooms", title: "Rooms" },
  { id: "gallery", hash: "#gallery", title: "Gallery" },
  { id: "booking", hash: "#booking", title: "Book" },
  { id: "contact", hash: "#contact", title: "Visit" },
  { id: "terms", hash: "#terms", title: "Terms" },
  { id: "staff-login", hash: "#staff/login", title: "Staff login" },
];

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const shots = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1.5,
      isMobile: false,
      hasTouch: true,
    });
    const page = await context.newPage();

    for (const p of PAGES) {
      const url = `${BASE}/${p.hash}`;
      console.log(`Capturing ${vp.id} ${p.id}…`);
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(1400);
        const file = `${vp.id}-${p.id}.png`;
        const path = join(outDir, file);
        await page.screenshot({ path, fullPage: false });
        shots.push({
          viewport: vp.label,
          width: vp.width,
          height: vp.height,
          page: p.title,
          file,
        });
      } catch (err) {
        console.error(`Failed ${vp.id}/${p.id}:`, err.message);
        shots.push({
          viewport: vp.label,
          width: vp.width,
          height: vp.height,
          page: p.title,
          file: null,
          error: err.message,
        });
      }
    }
    await context.close();
  }

  await browser.close();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Gayatri Convention — Tablet layout review</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #1a1a1a;
      margin: 0;
      padding: 24px;
      background: #f5f2eb;
    }
    h1 { font-size: 22px; margin: 0 0 6px; }
    .meta { color: #555; font-size: 13px; margin-bottom: 28px; }
    .sheet {
      break-after: page;
      page-break-after: always;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 16px 18px 20px;
      margin-bottom: 24px;
    }
    .sheet:last-child { break-after: auto; page-break-after: auto; }
    .sheet h2 { font-size: 16px; margin: 0 0 4px; }
    .sheet .sub { font-size: 12px; color: #666; margin-bottom: 12px; }
    .frame {
      display: flex;
      justify-content: center;
      background: #e8e4dc;
      border-radius: 6px;
      padding: 12px;
    }
    .frame img {
      max-width: 100%;
      height: auto;
      border: 1px solid #ccc;
      box-shadow: 0 4px 18px rgba(0,0,0,.12);
      background: #fff;
      /* Keep letterforms clear of any page-edge crop */
      padding-top: 8px;
      background-clip: content-box;
    }
    .err { color: #a00; font-size: 13px; }
    .cover { padding: 40px 24px; }
    .cover ul { line-height: 1.7; }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { border: none; box-shadow: none; margin: 0; padding: 8px 0; }
      .frame { padding: 8px 0; background: #fff; }
      .frame img {
        max-height: 160mm;
        padding-top: 4mm;
        object-fit: contain;
        object-position: top center;
      }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="sheet cover">
    <h1>Gayatri Convention — Tablet layout review</h1>
    <p class="meta">
      Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC<br/>
      Source: ${BASE}<br/>
      Viewports: iPad portrait 768×1024 · iPad landscape 1024×768
    </p>
    <p><strong>How to save as PDF:</strong> Open this file in Chrome → Ctrl+P → Destination: Save as PDF → Landscape → Save.</p>
    <p class="no-print"><strong>Check before public:</strong> Confirm nav, hero, venues reserve bar, gallery, contact, and staff login fit without horizontal cut-off or overlapping chrome on both orientations.</p>
    <ul>
      ${PAGES.map((p) => `<li>${p.title} (<code>${p.hash}</code>)</li>`).join("")}
    </ul>
  </div>
  ${shots
    .map((s) => {
      if (!s.file) {
        return `<div class="sheet"><h2>${s.page} — ${s.viewport}</h2><p class="err">Capture failed: ${s.error || "unknown"}</p></div>`;
      }
      return `<div class="sheet">
    <h2>${s.page}</h2>
    <p class="sub">${s.viewport} · ${s.width}×${s.height}</p>
    <div class="frame"><img src="./${s.file}" alt="${s.page} ${s.viewport}" /></div>
  </div>`;
    })
    .join("\n")}
</body>
</html>`;

  writeFileSync(join(outDir, "tablet-layout-review.html"), html);
  writeFileSync(join(outDir, "shots.json"), JSON.stringify(shots, null, 2));
  console.log(`Wrote ${shots.filter((s) => s.file).length} screenshots + tablet-layout-review.html`);
}

capture().catch((e) => {
  console.error(e);
  process.exit(1);
});
