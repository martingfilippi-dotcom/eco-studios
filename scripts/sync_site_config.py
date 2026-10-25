#!/usr/bin/env python3
"""Export the latest published ECO Studios visual configuration from Notion."""
from __future__ import annotations
import json, os, re, sys, urllib.error, urllib.request
from urllib.parse import urlsplit
from pathlib import Path

TOKEN = os.environ.get("NOTION_TOKEN")
DATA_SOURCE_ID = os.environ.get("NOTION_CONFIG_DATA_SOURCE_ID", "860acdc0-7ed3-4e05-86f3-d028788bb43e")
OUTPUT = Path("data/eco-site-config.json")
VERSION = "2025-09-03"
if not TOKEN:
    sys.exit("Missing NOTION_TOKEN; refusing to overwrite public site configuration.")

def request_json(url, payload=None):
    req = urllib.request.Request(
        url,
        data=None if payload is None else json.dumps(payload).encode("utf-8"),
        method="GET" if payload is None else "POST",
        headers={"Authorization": f"Bearer {TOKEN}", "Notion-Version": VERSION, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", "replace")
        sys.exit(f"Notion config API error {exc.code}: {details[:1000]}")

def text(parts):
    return "".join(x.get("plain_text", "") for x in (parts or [])).strip()

def value(prop):
    if not isinstance(prop, dict):
        return None
    kind = prop.get("type")
    if kind == "title":
        return text(prop.get("title"))
    if kind == "rich_text":
        return text(prop.get("rich_text"))
    if kind == "select":
        return (prop.get("select") or {}).get("name")
    if kind == "status":
        return (prop.get("status") or {}).get("name")
    if kind == "checkbox":
        return prop.get("checkbox") is True
    if kind == "url":
        return prop.get("url")
    return None

def safe_color(v, default):
    if not isinstance(v, str):
        return default
    v = v.strip()
    if re.fullmatch(r"#[0-9a-fA-F]{3,8}", v):
        return v
    if re.fullmatch(r"rgba?\(\s*[0-9.,%\s]+\)", v):
        return v
    return default

def safe_url(v, default=""):
    if not isinstance(v, str) or len(v) >= 1000:
        return default
    try:
        parsed = urlsplit(v.strip())
        port = parsed.port
    except ValueError:
        return default
    # Public config links stay on ECO's known GitHub Pages host; never export arbitrary destinations.
    if (
        parsed.scheme != "https"
        or parsed.hostname != "martingfilippi-dotcom.github.io"
        or parsed.username
        or parsed.password
        or port not in (None, 443)
    ):
        return default
    return v.strip()

def safe_text(v, default="", limit=500):
    if not isinstance(v, str):
        return default
    v = v.strip()
    return v[:limit] if v else default

def main():
    pages, cursor = [], None
    while True:
        payload = {"page_size": 100, "sorts": [{"timestamp": "last_edited_time", "direction": "descending"}]}
        if cursor:
            payload["start_cursor"] = cursor
        data = request_json(f"https://api.notion.com/v1/data_sources/{DATA_SOURCE_ID}/query", payload)
        pages.extend(data.get("results", []))
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
        if not cursor:
            break

    candidates = []
    for page in pages:
        props = page.get("properties", {})
        if value(props.get("Estado")) != "Publicado":
            continue
        cfg = {key: value(prop) for key, prop in props.items()}
        candidates.append((page.get("last_edited_time", ""), cfg))
    if not candidates:
        sys.exit("No published ECO site configuration found; refusing to replace existing config.")
    config_edited_at, p = max(candidates, key=lambda item: item[0])

    config = {
        "schemaVersion": 1,
        "source": "notion",
        # Stable between scheduled runs: only change the public file when the source record changes.
        "lastSync": config_edited_at or None,
        "colors": {
            "bg": safe_color(p.get("Color de fondo"), "#10100f"),
            "panel": safe_color(p.get("Color de panel"), "#191917"),
            "panel2": safe_color(p.get("Color de panel secundario"), "#20201d"),
            "text": safe_color(p.get("Color de texto"), "#f5f3ed"),
            "muted": safe_color(p.get("Color de texto secundario"), "#a8a69e"),
            "line": safe_color(p.get("Color de borde"), "rgba(245,243,237,.15)"),
            "orange": safe_color(p.get("Color de acento"), "#ff6a2b"),
            "orange2": safe_color(p.get("Color de acento secundario"), "#ff8b50"),
        },
        "fonts": {
            "body": p.get("Fuente de cuerpo") if p.get("Fuente de cuerpo") in {"DM Sans", "Inter", "Manrope", "Space Grotesk"} else "DM Sans",
            "heading": p.get("Fuente de títulos") if p.get("Fuente de títulos") in {"DM Sans", "Inter", "Manrope", "Space Grotesk"} else "Space Grotesk",
        },
        "brand": {
            "name": safe_text(p.get("Nombre de marca"), "ECO", 60),
            "subtitle": safe_text(p.get("Subtítulo de marca"), "STUDIOS", 80),
            "mark": safe_text(p.get("Letra del logo"), "E", 4),
            "seoDescription": safe_text(p.get("Descripción SEO"), "ECO Studios — música, artistas y producción audiovisual desde Paraguay.", 300),
        },
        "hero": {
            "eyebrow": safe_text(p.get("Texto miniatura hero"), "PLATAFORMA CREATIVA · ASUNCIÓN, PARAGUAY", 180),
            "titleLine1": safe_text(p.get("Título hero primera línea"), "Una voz.", 180),
            "titleLine2": safe_text(p.get("Título hero segunda línea"), "Muchos ecos.", 180),
            "description": safe_text(p.get("Descripción hero"), "Música, imágenes y comunidad.", 600),
            "primaryLabel": safe_text(p.get("Botón hero principal"), "Conocé el colectivo", 100),
            "primaryUrl": safe_url(p.get("Enlace hero principal"), "#artistas"),
            "secondaryLabel": safe_text(p.get("Botón hero secundario"), "Escuchar música", 100),
            "secondaryUrl": safe_url(p.get("Enlace hero secundario"), "#musica"),
        },
        "navigation": {
            "project": {"label": safe_text(p.get("Etiqueta menú proyecto"), "El proyecto", 80), "visible": p.get("Mostrar menú proyecto") is True, "href": "#historia"},
            "artists": {"label": safe_text(p.get("Etiqueta menú artistas"), "Artistas", 80), "visible": p.get("Mostrar menú artistas") is True, "href": "#artistas"},
            "music": {"label": safe_text(p.get("Etiqueta menú música"), "Música", 80), "visible": p.get("Mostrar menú música") is True, "href": "#musica"},
            "audiovisual": {"label": safe_text(p.get("Etiqueta menú audiovisual"), "Audiovisual", 80), "visible": p.get("Mostrar menú audiovisual") is True, "href": "#audiovisual"},
            "contact": {"label": safe_text(p.get("Etiqueta menú contacto"), "Contacto ↗", 80), "visible": p.get("Mostrar menú contacto") is True, "href": "#contacto"},
            "mobileLabel": safe_text(p.get("Etiqueta botón menú móvil"), "Menú", 40),
        },
        "communityReturn": {
            "visible": p.get("Mostrar enlace retorno comunidad") is True,
            "label": safe_text(p.get("Etiqueta retorno comunidad"), "VOLVER A COMUNIDAD DE ARTISTAS PARAGUAYOS", 160),
            "url": safe_url(p.get("URL retorno comunidad"), "https://martingfilippi-dotcom.github.io/comunidad-artistas-paraguayos./"),
        },
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Exported published visual config from {len(pages)} Notion record(s) to {OUTPUT}.")

if __name__ == "__main__":
    main()
