import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expected = JSON.parse(await readFile(path.join(root, "data/eco-site-config.json"), "utf8"));
const expectedClientScript = await readFile(path.join(root, "site-config.js"), "utf8");
const base = (process.env.ECO_LIVE_SITE_URL || "https://martingfilippi-dotcom.github.io/eco-studios/").replace(/\/?$/, "/");
const publicConfigUrl = new URL("data/eco-site-config.json", base).href;
const publicClientScriptUrl = new URL("site-config.js", base).href;

assert.equal(expected.schemaVersion, 1, "Repository config must use the supported schema");
assert.equal(expected.source, "notion", "Repository config must come from Notion export");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

let lastConfigError = "public config has not matched the repository copy yet";
let publicConfig = null;
for (let attempt = 1; attempt <= 20; attempt++) {
  try {
    const url = new URL(publicConfigUrl);
    url.searchParams.set("live_e2e", Date.now() + "-" + attempt);
    const response = await fetch(url, { headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    publicConfig = await response.json();
    assert.deepEqual(publicConfig, expected, "Public visual config differs from the checked-in Notion export");

    // The Pages deploy runs independently of this quality workflow. A matching
    // JSON file alone is not proof that the page JavaScript has reached this commit:
    // the JSON may be unchanged while site-config.js is still the previous version.
    const clientUrl = new URL(publicClientScriptUrl);
    clientUrl.searchParams.set("live_e2e", Date.now() + "-" + attempt);
    const clientResponse = await fetch(clientUrl, { headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" } });
    if (!clientResponse.ok) throw new Error("Public site-config.js HTTP " + clientResponse.status);
    const actualClientScript = await clientResponse.text();
    assert.equal(
      actualClientScript,
      expectedClientScript,
      "Public site-config.js is not deployed from the checked-in commit yet"
    );

    console.log("PASS: public Notion visual JSON matches the repository export.");
    console.log("PASS: public site-config.js matches the checked-in version; deployment is current.");
    break;
  } catch (error) {
    lastConfigError = String(error);
    console.log("Waiting for the deployed Notion configuration to match (" + attempt + "/20): " + lastConfigError);
    publicConfig = null;
    if (attempt < 20) await delay(5000);
  }
}
assert.ok(publicConfig, "Could not verify the public Notion visual JSON after deployment retries: " + lastConfigError);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const pageErrors = [];
  const failedResponses = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("response", response => {
    if (response.url().includes("/data/eco-site-config.json") && response.status() >= 400) {
      failedResponses.push({ url: response.url(), status: response.status() });
    }
  });

  const pageUrl = new URL(base);
  pageUrl.searchParams.set("live_visual_e2e", Date.now().toString());
  await page.goto(pageUrl.href, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(
    expectedBg => document.documentElement.style.getPropertyValue("--bg").trim() === expectedBg,
    expected.colors.bg,
    { timeout: 20000 }
  );

  const normalize = value => value.replace(/\s+/g, " ").trim();
  const heading = async (selector, first, second) => {
    assert.equal(
      normalize(await page.locator(selector).innerText()),
      normalize(first + " " + second),
      "Live website heading mismatch for " + selector
    );
  };
  assert.equal(await page.locator("header.site-header .brand-words").evaluate(el => el.childNodes[0].textContent), expected.brand.name);
  assert.equal(await page.locator("header.site-header .brand-words span").innerText(), expected.brand.subtitle);
  assert.equal(await page.locator(".hero-copy .eyebrow").evaluate(el => el.textContent), expected.hero.eyebrow);
  await heading(".hero-copy h1", expected.hero.titleLine1, expected.hero.titleLine2);
  assert.equal(await page.locator(".hero-lede").innerText(), expected.hero.description);
  assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue("--orange").trim()), expected.colors.orange);

  for (const [key, selector] of [
    ["history", "#historia"], ["artists", "#artistas"], ["music", "#musica"],
    ["audiovisual", "#audiovisual"], ["news", "#contenido-eco"],
    ["team", "#equipo"], ["contact", "#contacto"]
  ]) {
    const display = await page.locator(selector).evaluate(el => getComputedStyle(el).display);
    assert.equal(display !== "none", expected.visibility[key], "Live section visibility mismatch: " + key);
  }

  await heading("#historia h2", expected.history.titleLine1, expected.history.titleLine2);
  await heading("#artistas .section-heading h2", expected.artists.titleLine1, expected.artists.titleLine2);
  await heading("#musica .section-heading h2", expected.music.titleLine1, expected.music.titleLine2);
  await heading(".ov-intro h2", expected.audiovisual.titleLine1, expected.audiovisual.titleLine2);
  await heading("#contenido-eco .section-heading h2", expected.news.titleLine1, expected.news.titleLine2);
  await heading("#equipo .team-grid > div:first-child h2", expected.team.titleLine1, expected.team.titleLine2);
  assert.equal(await page.locator(".official-contact-list a[href^='mailto:']").getAttribute("href"), "mailto:" + expected.contact.email);
  assert.equal(await page.locator(".site-footer > p").innerText(), expected.footer.tagline);

  const ctaLabel = (expected.audiovisual.buttonLabel || "").replace(/\s*[↗↘→]+$/u, "").trim() + " ↗";
  assert.equal(
    normalize(await page.locator(".ov-actions .ov-cta").innerText()),
    normalize(ctaLabel),
    "Live audiovisual CTA must render with exactly one arrow"
  );

  if (expected.hero.imageUrl) {
    const liveHeroImage = await page.locator(".hero-art > img").evaluate(el => el.currentSrc || el.src);
    assert.equal(new URL(liveHeroImage).href, new URL(expected.hero.imageUrl).href, "Live hero image URL mismatch");
  }
  for (let i = 0; i < 2; i++) {
    const key = i === 0 ? "image1Url" : "image2Url";
    const configured = expected.audiovisual[key];
    if (configured) {
      const image = await page.locator(".ov-mosaic .ov-work img").nth(i).evaluate(el => el.currentSrc || el.src);
      assert.equal(new URL(image).href, new URL(configured).href, "Live audiovisual image mismatch: " + key);
    }
  }

  const desktop = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(desktop.document <= desktop.viewport, "Live desktop page overflows horizontally: " + JSON.stringify(desktop));
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => {
    const viewport = innerWidth;
    const offenders = Array.from(document.querySelectorAll("body *")).map(el => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id,
        className: typeof el.className === "string" ? el.className : "",
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        scrollWidth: el.scrollWidth,
        position: style.position,
        display: style.display,
        visibility: style.visibility,
        text: (el.innerText || "").replace(/\\s+/g, " ").slice(0, 70)
      };
    }).filter(el => el.display !== "none" && el.visibility !== "hidden" && el.right > viewport + 1 && el.position !== "fixed" && el.left > -100).slice(0, 20);
    return { viewport, document: document.documentElement.scrollWidth, offenders };
  });
  assert.ok(mobile.document <= mobile.viewport, "Live mobile page overflows horizontally: " + JSON.stringify(mobile));

  assert.deepEqual(failedResponses, [], "Live visual config request must not fail");
  assert.deepEqual(pageErrors, [], "Live page must not have uncaught browser errors");
  console.log("PASS: live website fetched and applied the real Notion-exported configuration.");
  console.log("PASS: live sections, images, public contact, theme, and the single-arrow audiovisual CTA match Notion.");
  console.log("PASS: deployed page has no horizontal overflow at desktop or mobile widths.");
} finally {
  await browser.close();
}
