#!/usr/bin/env python3
"""Lightweight, dependency-free quality checks for ECO Studios."""
from __future__ import annotations
import json
import posixpath
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE_HOST = "martingfilippi-dotcom.github.io"
SITE_PREFIX = "/eco-studios"
ERRORS: list[str] = []
WARNINGS: list[str] = []

def fail(message: str) -> None:
    ERRORS.append(message)

class PageAudit(HTMLParser):
    def __init__(self, path: Path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.ids: set[str] = set()
        self.title_count = 0
        self.title_text = ""
        self.in_title = False
        self.h1_count = 0
        self.meta_description_count = 0
        self.canonical_count = 0
        self.og_image_count = 0
        self.twitter_card_count = 0
        self.viewport_count = 0
        self.links: list[tuple[str, str]] = []
        self.images: list[dict[str, str]] = []
        self.iframes: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "title":
            self.title_count += 1
            self.in_title = True
        elif tag == "h1":
            self.h1_count += 1
        elif tag == "meta":
            name = a.get("name", "").lower()
            prop = a.get("property", "").lower()
            if name == "description":
                self.meta_description_count += 1
            elif name == "viewport":
                self.viewport_count += 1
            if prop == "og:image":
                self.og_image_count += 1
            if name == "twitter:card":
                self.twitter_card_count += 1
        elif tag == "link" and "canonical" in a.get("rel", "").lower().split():
            self.canonical_count += 1
        element_id = a.get("id", "")
        if element_id:
            if element_id in self.ids:
                fail(f"{self.path}: duplicated id={element_id!r}")
            self.ids.add(element_id)
        for attribute in ("href", "src", "poster"):
            value = a.get(attribute, "").strip()
            if value:
                self.links.append((attribute, value))
        if tag == "img":
            self.images.append(a)
        if tag == "iframe":
            self.iframes.append(a)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_text += data

def normalized_local_target(html_path: Path, raw_url: str) -> str | None:
    parsed = urlsplit(raw_url)
    if parsed.scheme.lower() in {"mailto", "tel", "data", "javascript"}:
        return None
    if parsed.scheme and parsed.scheme.lower() not in {"http", "https"}:
        return None
    path = unquote(parsed.path)
    if not path:
        return None
    if parsed.scheme in {"http", "https"}:
        if (parsed.hostname or "").lower() != SITE_HOST:
            return None
        if path == SITE_PREFIX:
            path = "/"
        elif path.startswith(SITE_PREFIX + "/"):
            path = path[len(SITE_PREFIX):]
        else:
            return None
    elif path.startswith(SITE_PREFIX + "/"):
        path = path[len(SITE_PREFIX):]
    elif path == SITE_PREFIX:
        path = "/"
    relative = path.lstrip("/") if path.startswith("/") else posixpath.join(html_path.parent.as_posix(), path)
    normalized = posixpath.normpath(relative)
    if normalized == ".":
        normalized = "index.html"
    if normalized.startswith("../") or normalized == "..":
        return "__OUTSIDE_REPO__"
    return normalized

def is_existing_route(relative: str) -> bool:
    if relative == "__OUTSIDE_REPO__":
        return False
    target = ROOT / relative
    if target.is_file():
        return True
    if target.is_dir() and (target / "index.html").is_file():
        return True
    if not Path(relative).suffix and (ROOT / relative / "index.html").is_file():
        return True
    return False

def check_html_files() -> None:
    files = sorted(p for p in ROOT.rglob("*.html") if ".git" not in p.parts)
    if not files:
        fail("No se encontraron archivos HTML.")
        return
    for path in files:
        rel = path.relative_to(ROOT)
        parser = PageAudit(rel)
        try:
            parser.feed(path.read_text(encoding="utf-8"))
            parser.close()
        except Exception as exc:
            fail(f"{rel}: HTML no se pudo analizar: {exc}")
            continue
        if parser.title_count != 1 or not parser.title_text.strip():
            fail(f"{rel}: debe tener exactamente un <title> con texto.")
        if parser.h1_count != 1:
            fail(f"{rel}: se esperaba exactamente un <h1>; encontrados {parser.h1_count}.")
        if parser.meta_description_count != 1:
            fail(f"{rel}: se esperaba una sola meta description; encontradas {parser.meta_description_count}.")
        if parser.viewport_count != 1:
            fail(f"{rel}: debe tener exactamente un meta viewport.")
        if parser.canonical_count != 1:
            fail(f"{rel}: debe tener exactamente un enlace canonical.")
        if rel.as_posix() == "index.html" or rel.as_posix().startswith("artistas/"):
            if parser.og_image_count != 1:
                fail(f"{rel}: falta exactamente una etiqueta og:image.")
            if parser.twitter_card_count != 1:
                fail(f"{rel}: falta exactamente una tarjeta twitter:card.")
        for image in parser.images:
            if "alt" not in image:
                fail(f"{rel}: imagen sin atributo alt (src={image.get('src', '')!r}).")
        for iframe in parser.iframes:
            if not iframe.get("title", "").strip():
                fail(f"{rel}: iframe sin título accesible (src={iframe.get('src', '')!r}).")
        for attribute, raw_url in parser.links:
            relative = normalized_local_target(rel, raw_url)
            if relative is not None and not is_existing_route(relative):
                fail(f"{rel}: {attribute} apunta a un recurso local inexistente: {raw_url!r} (resuelto como {relative!r}).")

def check_content_json() -> None:
    file_path = ROOT / "data" / "eco-content.json"
    try:
        payload = json.loads(file_path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"data/eco-content.json no es JSON válido: {exc}")
        return
    if payload.get("schemaVersion") != 1:
        fail("data/eco-content.json: schemaVersion debe ser 1.")
    items = payload.get("items")
    if not isinstance(items, list):
        fail("data/eco-content.json: 'items' debe ser una lista.")
        return
    names: set[str] = set()
    orders: set[int | float] = set()
    url_keys = ("imageUrl", "externalUrl", "instagramUrl", "tiktokUrl", "spotifyUrl", "youtubeUrl", "appleMusicUrl", "soundCloudUrl", "soundcloudUrl", "bandcampUrl", "deezerUrl", "websiteUrl")
    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            fail(f"data/eco-content.json: el elemento {index} no es un objeto.")
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            fail(f"data/eco-content.json: elemento {index} sin nombre.")
            continue
        key = name.casefold()
        if key in names:
            fail(f"data/eco-content.json: nombre duplicado {name!r}.")
        names.add(key)
        if item.get("status") == "Publicado" and item.get("permissionVerified") is not True:
            fail(f"data/eco-content.json: {name} está publicado sin permisos verificados.")
        order = item.get("order")
        if isinstance(order, (int, float)):
            if order in orders:
                fail(f"data/eco-content.json: orden duplicado {order!r}.")
            orders.add(order)
        for key_name in url_keys:
            value = item.get(key_name)
            if value is not None and value != "" and (not isinstance(value, str) or not value.startswith("https://")):
                fail(f"data/eco-content.json: {name}.{key_name} debe ser HTTPS o nulo.")
        if name.casefold() == "colki" and item.get("imageUrl") != "https://martingfilippi-dotcom.github.io/eco-studios/assets/colki.jpg":
            fail("data/eco-content.json: COLKI debe utilizar su retrato local del repositorio.")
    if payload.get("lastSync") is None:
        WARNINGS.append("data/eco-content.json: lastSync es null; revisar la sincronización editorial.")

def check_robots_and_sitemap() -> None:
    robots = ROOT / "robots.txt"
    sitemap = ROOT / "sitemap.xml"
    if not robots.is_file():
        fail("Falta robots.txt.")
    elif "https://martingfilippi-dotcom.github.io/eco-studios/sitemap.xml" not in robots.read_text(encoding="utf-8"):
        fail("robots.txt debe declarar el sitemap público.")
    if not sitemap.is_file():
        fail("Falta sitemap.xml.")
        return
    try:
        xml = ET.parse(sitemap)
    except Exception as exc:
        fail(f"sitemap.xml no es XML válido: {exc}")
        return
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locs = [n.text.strip() for n in xml.findall(".//sm:loc", ns) if n.text and n.text.strip()]
    if not locs:
        fail("sitemap.xml no contiene URLs.")
    for url in locs:
        relative = normalized_local_target(Path("index.html"), url)
        if relative is None or not is_existing_route(relative):
            fail(f"sitemap.xml contiene una URL sin página local correspondiente: {url!r}.")

def main() -> int:
    check_html_files()
    check_content_json()
    check_robots_and_sitemap()
    for warning in WARNINGS:
        print(f"::warning::{warning}")
    for error in ERRORS:
        print(f"::error::{error}")
    print(f"Auditoría estática ECO Studios: {len(ERRORS)} errores, {len(WARNINGS)} advertencias.")
    if ERRORS:
        return 1
    print("OK: HTML, metadatos, recursos locales, datos editoriales y sitemap cumplen los controles básicos.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
