import { chromium } from "playwright";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, "tablet-preview", "tablet-layout-review.html");
const pdfPath = join(__dirname, "tablet-preview", "Gayatri-Tablet-Layout-Review.pdf");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.pdf({
  path: pdfPath,
  format: "A4",
  landscape: true,
  printBackground: true,
  margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
});
await browser.close();
console.log("PDF written:", pdfPath);
