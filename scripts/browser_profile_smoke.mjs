import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDataPath = path.join(root, "data", "eco-content.json");
const fixture = JSON.parse(await readFile(publicDataPath, "utf8"));
const target = fixture.items.find((item) => item.slug === "lilmartincho");
assert.ok(target, "LILMARTINCHO must exist in the approved editorial JSON");
assert.equal(target.status, "Publicado");
assert.equal(target.permissionVerified, true);

const marker = "BIOGRAFÍA ACTUALIZADA POR NOTION · PROFILE-SYNC-SMOKE";
const testData = structuredClone(fixture);
const testArtist = testData.items.find((item) => item.slug === "lilmartincho");
testArtist.description = marker;
testArtist.instagramUrl = "https://www.instagram.com/eco-profile-sync-smoke/";
const base = process.env.ECO_TEST_BASE_URL || "http://127.0.0.1:4173";
const artifacts = path.join(root, "artifacts");
await mkdir(artifacts, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const page = await context.newPage();
  let fixtureServed = false;

  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.endsWith("/data/eco-content.json")) {
      fixtureServed = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify(testData),
      });
      return;
    }
    if (requestUrl.hostname !== "127.0.0.1" && requestUrl.hostname !== "localhost") {
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto(`${base}/artistas/lilmartincho/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    (expected) => document.querySelector(".bio")?.textContent.trim() === expected,
    marker,
    { timeout: 8000 },
  );
  assert.equal(fixtureServed, true, "The profile script must request the editorial JSON");
  assert.equal((await page.locator(".hero h1").innerText()).trim(), "LILMARTINCHO");
  assert.equal((await page.locator(".bio").innerText()).trim(), marker);
  assert.equal(await page.title(), "LILMARTINCHO — ECO Studios");
  assert.equal(await page.locator(".socials a[href='https://www.instagram.com/eco-profile-sync-smoke/']").count(), 1);
  await page.locator(".portrait").waitFor({ state: "visible" });
  await page.locator(".player iframe").waitFor({ state: "visible" });
  await page.locator("footer.foot").waitFor({ state: "visible" });

  const desktopWidth = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(desktopWidth.document <= desktopWidth.viewport, `Desktop horizontal overflow: ${JSON.stringify(desktopWidth)}`);
  await page.screenshot({ path: path.join(artifacts, "profile-sync-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  const mobileWidth = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(mobileWidth.document <= mobileWidth.viewport, `Mobile horizontal overflow: ${JSON.stringify(mobileWidth)}`);
  assert.equal((await page.locator(".bio").innerText()).trim(), marker);
  await page.screenshot({ path: path.join(artifacts, "profile-sync-mobile.png"), fullPage: true });
  console.log("PASS: approved Notion content updates the existing profile without losing its layout.");
  console.log(`PASS: responsive layout has no horizontal overflow (desktop ${desktopWidth.document}px; mobile ${mobileWidth.document}px).`);
  await context.close();

  // Failure-safe check: if JSON is unavailable, the known-good static profile must remain visible.
  const fallbackPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await fallbackPage.route("**/data/eco-content.json*", (route) =>
    route.fulfill({ status: 503, body: "temporarily unavailable" }),
  );
  await fallbackPage.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.hostname !== "127.0.0.1" && requestUrl.hostname !== "localhost") {
      await route.abort();
      return;
    }
    await route.continue();
  });
  await fallbackPage.goto(`${base}/artistas/lilmartincho/`, { waitUntil: "domcontentloaded" });
  await fallbackPage.waitForTimeout(350);
  assert.equal((await fallbackPage.locator(".hero h1").innerText()).trim(), "LILMARTINCHO");
  assert.ok((await fallbackPage.locator(".bio").innerText()).includes("freestyler"));
  await fallbackPage.locator(".player iframe").waitFor({ state: "visible" });
  console.log("PASS: if the editorial JSON is unavailable, the static profile fallback remains visible.");
  await fallbackPage.close();
} finally {
  await browser.close();
}
