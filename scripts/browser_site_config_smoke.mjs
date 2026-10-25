import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
await mkdir(artifacts, { recursive: true });

const hostileText = '<img src=x onerror="alert(1)">';
const config = {
  schemaVersion: 1,
  source: "automated-security-test",
  lastSync: "2026-10-25T00:00:00Z",
  colors: {
    bg: "#172033",
    panel: "#23314a",
    panel2: "#2d3e59",
    text: "#f9fafb",
    muted: "#cbd5e1",
    line: "rgba(255,255,255,.2)",
    orange: "red; background-image: url(javascript:alert(1))",
    orange2: "#86efac"
  },
  fonts: { body: "Inter", heading: "Manrope" },
  brand: { name: hostileText, subtitle: "QA MODE", mark: "Q", seoDescription: "QA configuration applied" },
  hero: {
    eyebrow: "CONFIGURACIÓN DE PRUEBA",
    titleLine1: "Config OK",
    titleLine2: hostileText,
    description: "Esta configuración es un fixture local de prueba; no se publica.",
    primaryLabel: "Probar principal",
    primaryUrl: "javascript:alert(1)",
    secondaryLabel: "Probar secundaria",
    secondaryUrl: "https://evil.example/path"
  },
  navigation: {
    project: { label: "Proyecto QA", visible: true, href: "#historia" },
    artists: { label: "Artistas ocultos QA", visible: false, href: "#artistas" },
    music: { label: "Música QA", visible: true, href: "#musica" },
    audiovisual: { label: "Audiovisual QA", visible: true, href: "#audiovisual" },
    contact: { label: "Contacto QA", visible: true, href: "#contacto" },
    mobileLabel: "Navegación QA"
  },
  communityReturn: {
    visible: false,
    label: "Retorno oculto QA",
    url: "https://martingfilippi-dotcom.github.io/comunidad-artistas-paraguayos./"
  }
};

const base = process.env.ECO_TEST_BASE_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  let configRequested = false;
  page.on("pageerror", error => {
    if (/alert is not defined/i.test(error.message)) {
      throw error;
    }
  });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/data/eco-site-config.json")) {
      configRequested = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify(config)
      });
      return;
    }
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      await route.continue();
      return;
    }
    await route.abort();
  });

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.style.getPropertyValue("--bg") === "#172033", null, { timeout: 8000 });
  assert.equal(configRequested, true, "site-config.js must request its JSON configuration");
  assert.equal(await page.locator(".brand-mark").innerText(), "Q");
  assert.equal(await page.locator(".brand-words span").innerText(), "QA MODE");
  assert.equal(await page.locator(".brand-words svg, .brand-words img").count(), 0, "Brand text must not become executable HTML");
  assert.equal(await page.locator(".hero-copy h1").evaluate(el => el.childNodes[0].textContent), "Config OK");
  assert.equal(await page.locator(".hero-copy h1 span").innerText(), hostileText, "Untrusted text must be rendered as text");
  assert.equal(await page.locator(".hero-copy h1 img, .hero-copy h1 svg").count(), 0, "Hero text must not inject HTML nodes");
  assert.equal(await page.locator(".hero-actions .button-orange").getAttribute("href"), "#artistas", "javascript: links must fall back to a safe in-site anchor");
  assert.equal(await page.locator(".hero-actions .text-link").getAttribute("href"), "#musica", "untrusted external hosts must fall back to a safe in-site anchor");
  assert.equal(await page.locator(".hero-actions .button-orange").innerText(), "Probar principal ↘");
  assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue("--orange")), "", "invalid CSS values must not override the brand accent");
  assert.match(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--orange")), /#ff6a2b/i, "invalid CSS must leave the original accent unchanged");
  assert.equal(await page.locator(".main-nav a[href='#artistas']").evaluate(el => getComputedStyle(el).display), "none", "A hidden navigation item must actually be hidden");
  assert.equal(await page.locator(".main-nav a[href='#historia']").innerText(), "Proyecto QA");
  assert.equal(await page.locator(".menu-toggle b").innerText(), "Navegación QA");
  assert.equal(await page.locator(".community-return-bar").evaluate(el => getComputedStyle(el).display), "none", "Disabled community return bar must actually be hidden");
  assert.equal(await page.locator('meta[name="description"]').getAttribute("content"), "QA configuration applied");
  assert.match(await page.evaluate(() => getComputedStyle(document.body).fontFamily), /Inter/);
  assert.match(await page.locator(".hero-copy h1").evaluate(el => getComputedStyle(el).fontFamily), /Manrope/);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--orange").trim()), "#22c55e");

  const desktop = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(desktop.document <= desktop.viewport, "Desktop layout must not overflow horizontally: " + JSON.stringify(desktop));
  await page.screenshot({ path: path.join(artifacts, "site-config-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(mobile.document <= mobile.viewport, "Mobile layout must not overflow horizontally: " + JSON.stringify(mobile));
  await page.screenshot({ path: path.join(artifacts, "site-config-mobile.png"), fullPage: true });
  console.log("PASS: Notion-managed visual configuration is fetched and applied.");
  console.log("PASS: unsafe links fall back safely and hostile text is rendered without HTML injection.");
  console.log("PASS: menu visibility, dynamic typography, and mobile/desktop overflow checks passed.");
} finally {
  await browser.close();
}
