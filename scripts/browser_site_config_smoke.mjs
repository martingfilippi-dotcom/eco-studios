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
  visibility: {
    history: true, artists: true, music: true, audiovisual: true,
    news: false, team: true, contact: true
  },
  history: {
    eyebrow: "HISTORIA QA", kicker: "CONTENIDO CONFIGURADO",
    titleLine1: "Nuestra historia", titleLine2: "Un eco real.",
    body1: "Texto principal administrado desde Notion.",
    body2: "Texto secundario administrado desde Notion.",
    origin: "Origen editado desde Notion.",
    teamLink: "Conocé al equipo QA",
    values: ["VALOR A", "VALOR B", "VALOR C", "VALOR D"]
  },
  artists: {
    eyebrow: "ROSTER QA", kicker: "ARTISTAS DE PRUEBA",
    titleLine1: "Voces nuevas", titleLine2: "Mismo eco.",
    description: "Descripción de artistas editada desde Notion.",
    directoryLabel: "Directorio QA"
  },
  music: {
    eyebrow: "MÚSICA QA", kicker: "LANZAMIENTOS QA",
    titleLine1: "Música nueva", titleLine2: "Cada semana.",
    description: "Descripción musical configurada desde Notion.",
    note: "Nota del catálogo configurada desde Notion.",
    noteUrl: "https://music.apple.com/us/album/eco-live-at-black-mango-live/1822286569"
  },
  audiovisual: {
    eyebrow: "AUDIOVISUAL QA", kicker: "PRODUCCIÓN QA",
    topline: "DIRECCIÓN QA", titleLine1: "Imagen nueva", titleLine2: "Identidad propia.",
    lead: "Texto de portada audiovisual QA.",
    description: "Descripción audiovisual QA.",
    buttonLabel: "Contacto audiovisual QA",
    buttonUrl: "https://wa.me/595972861717",
    instagramLabel: "Instagram audiovisual QA",
    instagramUrl: "https://www.instagram.com/ov.audiovisual/"
  },
  news: {
    eyebrow: "NOVEDADES QA", kicker: "CONTENIDO QA",
    titleLine1: "Novedades", titleLine2: "Publicadas.",
    description: "Descripción de novedades QA."
  },
  team: {
    eyebrow: "EQUIPO QA", kicker: "DETRÁS DE QA",
    titleLine1: "Equipo unido", titleLine2: "Trabajo real.",
    description: "Descripción del equipo QA."
  },
  contact: {
    eyebrow: "CONTACTO QA", kicker: "CANALES QA",
    email: "contacto@example.com", whatsappLabel: "WHATSAPP QA",
    phone: "595994562633"
  },
  footer: { tagline: "Lema QA", copyright: "© ECO QA", backTop: "VOLVER QA ↑" },
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
let page = null;
let pageErrors = [];
let unexpectedDialogs = [];
let configRequested = false;
try {
  page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  page.on("pageerror", error => { pageErrors.push(error.message); console.log("BROWSER_PAGE_ERROR:", error.message); });
  page.on("close", () => console.log("BROWSER_PAGE_CLOSED"));
  page.on("crash", () => console.log("BROWSER_PAGE_CRASHED"));
  page.on("dialog", async dialog => {
    unexpectedDialogs.push({ type: dialog.type(), message: dialog.message() });
    console.log("UNEXPECTED_BROWSER_DIALOG:", dialog.type(), dialog.message());
    await dialog.dismiss();
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
  assert.equal(await page.locator("header.site-header .brand-mark").innerText(), "Q");
  assert.equal(await page.locator("header.site-header .brand-words span").innerText(), "QA MODE");
  assert.equal(await page.locator("header.site-header .brand-words svg, header.site-header .brand-words img").count(), 0, "Brand text must not become executable HTML");
  assert.equal(await page.locator(".brand-mark").evaluate(el => getComputedStyle(el, "::before").content), "none", "Legacy decorative curve must not overlap the brand letter");
  assert.equal(await page.locator(".brand-mark").evaluate(el => getComputedStyle(el, "::after").content), "none", "Legacy waves must not double up inside the brand square");
  assert.notEqual(await page.locator(".brand-words").evaluate(el => getComputedStyle(el, "::after").content), "none", "The ECO wordmark must retain its sound-wave mark");
  assert.equal(await page.locator(".hero-actions .button-orange > span").evaluate(el => getComputedStyle(el).fontSize), "0px", "Primary CTA arrow must use the CSS-drawn icon, not an emoji glyph");
  assert.equal(await page.locator(".hero-actions .button-orange > span").evaluate(el => getComputedStyle(el, "::after").borderTopStyle), "solid", "Primary CTA arrowhead must be visible");
  assert.equal(await page.locator(".hero-actions .text-link > span").evaluate(el => getComputedStyle(el, "::after").borderTopStyle), "solid", "Secondary CTA arrowhead must be visible");
  assert.equal(await page.locator(".hero-copy h1").evaluate(el => el.childNodes[0].textContent), "Config OK");
  assert.equal(await page.locator(".hero-copy h1 span").innerText(), hostileText, "Untrusted text must be rendered as text");
  assert.equal(await page.locator(".hero-copy h1 img, .hero-copy h1 svg").count(), 0, "Hero text must not inject HTML nodes");
  assert.equal(await page.locator(".hero-actions .button-orange").getAttribute("href"), "#artistas", "javascript: links must fall back to a safe in-site anchor");
  assert.equal(await page.locator(".hero-actions .text-link").getAttribute("href"), "#musica", "untrusted external hosts must fall back to a safe in-site anchor");
  assert.equal((await page.locator(".hero-actions .button-orange").innerText()).replace(/\s+/g, " ").trim(), "Probar principal ↘");
  assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue("--orange")), "", "invalid CSS values must not override the brand accent");
  assert.match(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--orange")), /#ff6a00/i, "invalid CSS must leave the original accent unchanged");
  assert.equal(await page.locator(".main-nav a[href='#artistas']").evaluate(el => getComputedStyle(el).display), "none", "A hidden navigation item must actually be hidden");
  assert.equal(await page.locator(".main-nav a[href='#historia']").innerText(), "Proyecto QA");
  assert.equal(await page.locator(".menu-toggle b").innerText(), "Navegación QA");
  assert.equal(await page.locator(".community-return-bar").evaluate(el => getComputedStyle(el).display), "none", "Disabled community return bar must actually be hidden");
  assert.equal(await page.locator("#contenido-eco").evaluate(el => getComputedStyle(el).display), "none", "Section visibility must be editable from the visual editor");
  console.log("CHECK_BEFORE_HISTORY_HEADING", { pageClosed: page.isClosed(), pageErrors, unexpectedDialogs });
  assert.equal((await page.locator("#historia h2").innerText()).replace(/\s+/g, " ").trim(), "Nuestra historia Un eco real.");
  console.log("CHECK_AFTER_HISTORY_HEADING");
  assert.equal(await page.locator("#historia .intro-body > p").first().innerText(), "Texto principal administrado desde Notion.");
  assert.equal(await page.locator("#artistas .section-heading > p a").innerText(), "Directorio QA");
  assert.equal((await page.locator(".ov-intro h2").innerText()).replace(/\s+/g, " ").trim(), "Imagen nueva Identidad propia.");
  assert.equal(await page.locator(".ov-actions .ov-cta").getAttribute("href"), "https://wa.me/595972861717");
  assert.equal(await page.locator(".official-contact-list a[href^='mailto:']").getAttribute("href"), "mailto:contacto@example.com");
  assert.equal(await page.locator(".site-footer > p").innerText(), "Lema QA");
  assert.equal(await page.locator('meta[name="description"]').getAttribute("content"), "QA configuration applied");
  assert.equal(pageErrors.some(message => /alert is not defined/i.test(message)), false, "Hostile configuration must not execute injected JavaScript");
  assert.deepEqual(unexpectedDialogs, [], "Hostile configuration must not trigger browser dialogs");
  assert.match(await page.evaluate(() => getComputedStyle(document.body).fontFamily), /Inter/);
  assert.match(await page.locator(".hero-copy h1").evaluate(el => getComputedStyle(el).fontFamily), /Manrope/);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--orange").trim()), "#ff6a00", "invalid injected CSS must preserve the original accent");

  const desktop = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(desktop.document <= desktop.viewport, "Desktop layout must not overflow horizontally: " + JSON.stringify(desktop));
  await page.screenshot({ path: path.join(artifacts, "site-config-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  const overflowers = await page.evaluate(() => [...document.querySelectorAll("body *")].map(el => ({tag: el.tagName.toLowerCase(), cls: typeof el.className === "string" ? el.className : "", id: el.id, left: Math.round(el.getBoundingClientRect().left), right: Math.round(el.getBoundingClientRect().right), width: Math.round(el.getBoundingClientRect().width), scrollWidth: el.scrollWidth, text: (el.innerText || "").slice(0, 70)})).filter(el => el.right > innerWidth + 1 || el.left < -1).slice(0, 20));
  assert.ok(mobile.document <= mobile.viewport, "Mobile layout must not overflow horizontally: " + JSON.stringify({ ...mobile, overflowers }));
  await page.screenshot({ path: path.join(artifacts, "site-config-mobile.png"), fullPage: true });
  console.log("PASS: Notion-managed visual configuration is fetched and applied.");
  console.log("PASS: unsafe links fall back safely and hostile text is rendered without HTML injection.");
  console.log("PASS: menu visibility, dynamic typography, and mobile/desktop overflow checks passed.");
} catch (error) {
  console.error("VISUAL_SMOKE_FAILURE_DIAGNOSTICS", {
    error: String(error),
    stack: error && error.stack,
    pageClosed: page ? page.isClosed() : null,
    pageErrors,
    unexpectedDialogs
  });
  throw error;
} finally {
  await browser.close();
}
