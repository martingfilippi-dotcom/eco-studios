import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
await mkdir(artifacts, { recursive: true });
const config = JSON.parse(await readFile(path.join(root, "data/eco-site-config.json"), "utf8"));

assert.equal(config.schemaVersion, 1, "Published Notion config must use supported schema version 1");
assert.equal(config.source, "notion", "The active config must be exported from Notion, not a test fixture");
assert.ok(config.lastSync && !Number.isNaN(Date.parse(config.lastSync)), "Published Notion config must expose a valid source edit/sync timestamp");
for (const name of ["bg", "panel", "panel2", "text", "muted", "line", "orange", "orange2"]) {
  assert.equal(typeof config.colors?.[name], "string", "Missing theme color: " + name);
}
assert.ok(config.hero?.titleLine1 && config.hero?.titleLine2, "Published hero copy must be configured");
assert.ok(config.brand?.name && config.brand?.subtitle && config.brand?.mark, "Published brand must be configured");
assert.ok(config.visibility && ["history", "artists", "music", "audiovisual", "news", "team", "contact"].every(key => typeof config.visibility[key] === "boolean"), "All homepage sections must have explicit visibility settings");

const base = process.env.ECO_TEST_BASE_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
let page;
try {
  page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const pageErrors = [];
  const unexpectedDialogs = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("dialog", async dialog => {
    unexpectedDialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.dismiss();
  });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      await route.continue();
    } else {
      // The production config is tested locally; external assets/fonts are not needed
      // to verify that its public values are applied to the site's DOM safely.
      await route.abort();
    }
  });

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    expected => document.documentElement.style.getPropertyValue("--bg").trim() === expected,
    config.colors.bg,
    { timeout: 8000 }
  );

  const normalize = value => value.replace(/\s+/g, " ").trim();
  const heading = async (selector, first, second) => {
    const actual = normalize(await page.locator(selector).innerText());
    assert.equal(actual, normalize(first + " " + second), "Notion heading mapping mismatch for " + selector);
  };
  const text = async (selector, expected) => {
    assert.equal(await page.locator(selector).innerText(), expected, "Notion text mapping mismatch for " + selector);
  };

  for (const [key, value] of Object.entries({
    "--bg": config.colors.bg,
    "--panel": config.colors.panel,
    "--panel-2": config.colors.panel2,
    "--text": config.colors.text,
    "--muted": config.colors.muted,
    "--line": config.colors.line,
    "--orange": config.colors.orange,
    "--orange-2": config.colors.orange2
  })) {
    assert.equal(await page.evaluate(key => document.documentElement.style.getPropertyValue(key).trim(), key), value, "Theme token mismatch: " + key);
  }

  assert.equal(await page.locator(".brand-words").evaluate(el => el.childNodes[0].textContent), config.brand.name);
  await text(".brand-words span", config.brand.subtitle);
  await text(".brand-mark", config.brand.mark);
  assert.equal(await page.locator('meta[name="description"]').getAttribute("content"), config.brand.seoDescription);
  assert.equal(await page.locator(".hero-copy .eyebrow").evaluate(el => el.textContent), config.hero.eyebrow);
  await heading(".hero-copy h1", config.hero.titleLine1, config.hero.titleLine2);
  await text(".hero-lede", config.hero.description);
  for (const [selector, expected] of [
    [".hero-actions .button-orange", config.hero.primaryUrl],
    [".hero-actions .text-link", config.hero.secondaryUrl]
  ]) {
    const actual = await page.locator(selector).getAttribute("href");
    assert.equal(new URL(actual, base).href, new URL(expected, base).href, "Hero action URL mismatch for " + selector);
  }

  const sections = [
    ["history", "#historia"], ["artists", "#artistas"], ["music", "#musica"],
    ["audiovisual", "#audiovisual"], ["news", "#contenido-eco"],
    ["team", "#equipo"], ["contact", "#contacto"]
  ];
  for (const [key, selector] of sections) {
    const display = await page.locator(selector).evaluate(el => getComputedStyle(el).display);
    assert.equal(display !== "none", config.visibility[key], "Section visibility mismatch: " + key);
  }

  await text("#historia .section-kicker > span:nth-child(1)", config.history.eyebrow);
  await text("#historia .section-kicker > span:nth-child(2)", config.history.kicker);
  await heading("#historia h2", config.history.titleLine1, config.history.titleLine2);
  await text("#historia .intro-body > p:nth-of-type(1)", config.history.body1);
  await text("#historia .intro-body > p:nth-of-type(2)", config.history.body2);
  await text("#historia .intro-body > p:nth-of-type(3)", config.history.origin);
  await text("#historia .intro-body > a", config.history.teamLink);
  for (let i = 0; i < 4; i++) {
    const actual = await page.locator("#historia .value-strip span").nth(i).innerText();
    assert.equal(actual, config.history.values[i], "History value mapping mismatch at index " + i);
  }

  await text("#artistas .section-kicker > span:nth-child(1)", config.artists.eyebrow);
  await text("#artistas .section-kicker > span:nth-child(2)", config.artists.kicker);
  await heading("#artistas .section-heading h2", config.artists.titleLine1, config.artists.titleLine2);
  const artistsDescription = page.locator("#artistas .section-heading > p");
  await page.waitForFunction(() => !!document.querySelector("#artistas .section-heading > p a"));
  assert.ok((await artistsDescription.innerText()).includes(config.artists.description));
  await text("#artistas .section-heading > p a", config.artists.directoryLabel);

  await text("#musica .section-kicker > span:nth-child(1)", config.music.eyebrow);
  await text("#musica .section-kicker > span:nth-child(2)", config.music.kicker);
  await heading("#musica .section-heading h2", config.music.titleLine1, config.music.titleLine2);
  await text("#musica .section-heading > p", config.music.description);
  await text(".music-note p", config.music.note);
  const musicNoteUrl = await page.locator(".music-note .text-link").getAttribute("href");
  assert.equal(new URL(musicNoteUrl, base).href, new URL(config.music.noteUrl, base).href);

  await text("#audiovisual .section-kicker > span:nth-child(1)", config.audiovisual.eyebrow);
  await text("#audiovisual .section-kicker > span:nth-child(2)", config.audiovisual.kicker);
  await text(".ov-intro .ov-eyebrow", config.audiovisual.topline);
  await heading(".ov-intro h2", config.audiovisual.titleLine1, config.audiovisual.titleLine2);
  await text(".ov-intro p.large-copy", config.audiovisual.lead);
  await text(".ov-intro > p:not(.ov-eyebrow):nth-of-type(2)", config.audiovisual.description);
  const avButtonText = (config.audiovisual.buttonLabel || "").replace(/\\s*[↗↘→]+$/u, "").trim() + " ↗";
  assert.equal(normalize(await page.locator(".ov-actions .ov-cta").innerText()), normalize(avButtonText), "Audiovisual CTA must show exactly one arrow.");
  assert.equal(new URL(await page.locator(".ov-actions .ov-cta").getAttribute("href"), base).href, new URL(config.audiovisual.buttonUrl, base).href);
  assert.equal(new URL(await page.locator(".ov-actions .ov-instagram").getAttribute("href"), base).href, new URL(config.audiovisual.instagramUrl, base).href);

  await text("#contenido-eco .section-kicker > span:nth-child(1)", config.news.eyebrow);
  await text("#contenido-eco .section-kicker > span:nth-child(2)", config.news.kicker);
  await heading("#contenido-eco .section-heading h2", config.news.titleLine1, config.news.titleLine2);
  await text("#contenido-eco .section-heading > p", config.news.description);
  await text("#equipo .section-kicker > span:nth-child(1)", config.team.eyebrow);
  await text("#equipo .section-kicker > span:nth-child(2)", config.team.kicker);
  await heading("#equipo .team-grid > div:first-child h2", config.team.titleLine1, config.team.titleLine2);
  await text("#equipo .team-grid > div:first-child p", config.team.description);
  await text("#contacto .section-kicker > span:nth-child(1)", config.contact.eyebrow);
  await text("#contacto .section-kicker > span:nth-child(2)", config.contact.kicker);
  assert.equal(await page.locator(".official-contact-list a[href^='mailto:']").getAttribute("href"), "mailto:" + config.contact.email);
  await text(".official-contact-list a[href*='wa.me'] .contact-label", config.contact.whatsappLabel);
  const expectedPhone = "+" + config.contact.phone.replace(/\D/g, "");
  await text(".official-contact-list a[href*='wa.me'] strong > span", expectedPhone);
  await text(".site-footer > p", config.footer.tagline);
  await text(".site-footer .copyright", config.footer.copyright);
  await text(".site-footer .back-top", config.footer.backTop);

  for (const item of [
    ["project", 'a[href="#historia"]'],
    ["artists", 'a[href="#artistas"]'],
    ["music", 'a[href="#musica"]'],
    ["audiovisual", 'a[href="#audiovisual"]'],
    ["contact", 'a[href="#contacto"]']
  ]) {
    const [key, selector] = item;
    const link = page.locator(".main-nav " + selector);
    await text(".main-nav " + selector, config.navigation[key].label);
    assert.equal((await link.evaluate(el => getComputedStyle(el).display) !== "none"), config.navigation[key].visible && config.visibility[key === "project" ? "history" : key], "Navigation visibility mismatch: " + key);
  }
  await text(".menu-toggle b", config.navigation.mobileLabel);
  const returnBar = page.locator(".community-return-bar");
  assert.equal((await returnBar.evaluate(el => getComputedStyle(el).display) !== "none"), config.communityReturn.visible);
  if (config.communityReturn.visible) {
    await text(".community-return-bar a", config.communityReturn.label);
    assert.equal(new URL(await returnBar.locator("a").getAttribute("href"), base).href, new URL(config.communityReturn.url, base).href);
  }

  assert.match(await page.evaluate(() => getComputedStyle(document.body).fontFamily), new RegExp(config.fonts.body.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(await page.locator(".hero-copy h1").evaluate(el => getComputedStyle(el).fontFamily), new RegExp(config.fonts.heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const desktop = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(desktop.document <= desktop.viewport, "Actual Notion config overflows desktop: " + JSON.stringify(desktop));
  await page.screenshot({ path: path.join(artifacts, "site-config-published-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(mobile.document <= mobile.viewport, "Actual Notion config overflows mobile: " + JSON.stringify(mobile));
  await page.screenshot({ path: path.join(artifacts, "site-config-published-mobile.png"), fullPage: true });

  assert.deepEqual(pageErrors, [], "Published config must not trigger uncaught browser errors");
  assert.deepEqual(unexpectedDialogs, [], "Published config must not trigger browser dialogs");
  console.log("PASS: The committed Notion-exported configuration is present, current, and uses the supported schema.");
  console.log("PASS: Brand, theme, all homepage copy sections, navigation, visibility, contact links, and footer render from the actual Notion configuration.");
  console.log("PASS: The real published configuration keeps desktop/mobile widths within the viewport.");
} finally {
  await browser.close();
}
