// Captura el home web en claro y oscuro para comparar con los mockups.
// Uso: node scripts/home-screenshot.js
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await page.goto("http://localhost:8081", { waitUntil: "domcontentloaded", timeout: 180000 });
  // el bundle web y el backend (Render, cold start) pueden tardar
  await page.waitForTimeout(45000);
  // saltar onboarding si aparece
  const skip = page.getByText("Saltar", { exact: true });
  if (await skip.count()) {
    await skip.click();
  }
  await page.waitForTimeout(30000);
  await page.screenshot({ path: "logs/home-web-light.png", fullPage: false });

  // modo oscuro vía prefers-color-scheme (themeMode por defecto = system)
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(20000);
  await page.screenshot({ path: "logs/home-web-dark.png", fullPage: false });

  await browser.close();
  console.log("OK -> logs/home-web-light.png, logs/home-web-dark.png");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
